/*
 * therd-package - World packaging tool for THerD Platform
 *
 * Creates validated world packages (zip archives) from directory structure.
 * Validates manifest.json schema and checks all referenced files exist.
 * Compiles .grav Gravity scripts to .gbc bytecode during packaging.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <dirent.h>
#include <errno.h>
#include "cJSON.h"
/* miniz (v11.0.2) is VENDORED here (packaging/miniz.[ch]) and is byte-identical
 * to THerD/third_party/miniz.[ch]. The two copies MUST be updated in sync —
 * security patches to miniz apply to both. */
#include "miniz.h"

#include "gravity_compiler.h"
#include "gravity_vm.h"
#include "gravity_core.h"
#include "gravity_delegate.h"

#define MAX_PATH_LEN 1024
#define VERSION "0.1.0"

/* Aria packaging documents a 50 MB package size limit (Aria-Studio/CONTEXT.md:
 * "Package size <= 50MB"; see also SPEC-ARIA-STUDIO.md section 4.8). Enforced
 * in do_create() as a running total of uncompressed content bytes added to
 * the package — the correct metric for guarding against a decompression-bomb
 * style upload, and conservative vs. the smaller final compressed .therd size. */
#define PACKAGE_SIZE_CAP_BYTES ((size_t)50 * 1024 * 1024)

typedef struct {
    char** errors;
    int error_count;
    int error_capacity;
} ValidationResult;

/* Compile context for error tracking */
typedef struct {
    int had_error;
    const char *src_path;
} CompileContext;

/* Forward declarations */
static cJSON* read_manifest_json(const char* dir_path, ValidationResult* result);
static cJSON* validate_manifest(const char* dir_path, ValidationResult* result);
static int do_create(const char* dir_path, const char* output_path);
static int do_validate(const char* dir_path);
static void add_error(ValidationResult* result, const char* error);
static void free_validation_result(ValidationResult* result);
static int pkg_file_exists(const char* path);
static int path_escapes_package_dir(const char* path);
static int is_over_size_cap(size_t total_bytes);
static int add_directory_to_zip(mz_zip_archive* zip, const char* base_path, const char* rel_prefix, size_t* running_total);
static int add_file_to_zip(mz_zip_archive* zip, const char* file_path, const char* archive_path, size_t* running_total);
static char *compile_grav_script(const char* src_path);
static int compile_scripts_dir(mz_zip_archive* zip, const char* base_path, const char* entry_script, char* compiled_entry, size_t* running_total);

/* Add error to validation result */
static void add_error(ValidationResult* result, const char* error) {
    if (result->error_count >= result->error_capacity) {
        result->error_capacity = (result->error_capacity == 0) ? 8 : result->error_capacity * 2;
        result->errors = realloc(result->errors, result->error_capacity * sizeof(char*));
    }
    result->errors[result->error_count++] = strdup(error);
}

static void free_validation_result(ValidationResult* result) {
    for (int i = 0; i < result->error_count; i++) {
        free(result->errors[i]);
    }
    free(result->errors);
    result->errors = NULL;
    result->error_count = 0;
    result->error_capacity = 0;
}

/* Check if file exists */
static int pkg_file_exists(const char* path) {
    struct stat st;
    return (stat(path, &st) == 0 && S_ISREG(st.st_mode));
}

/*
 * Reject manifest asset/library paths that could escape the package
 * directory: a leading '/' (absolute path), a backslash (Windows-style
 * absolute/parent path), or a '..' path component. Fail-closed — any of
 * these patterns is rejected before the path is ever used to build a
 * filesystem path.
 */
static int path_escapes_package_dir(const char* path) {
    if (!path || path[0] == '\0') return 0;
    if (path[0] == '/') return 1;
    if (strchr(path, '\\')) return 1;
    if (strstr(path, "..")) return 1;
    return 0;
}

/*
 * Pure helper so the package size-cap comparison can be unit tested without
 * assembling a real 50MB+ package on disk. Do not weaken this to make
 * testing easier elsewhere — the enforcement site (do_create) must call
 * this exact function.
 */
static int is_over_size_cap(size_t total_bytes) {
    return total_bytes > PACKAGE_SIZE_CAP_BYTES;
}

/*
 * Read and parse manifest.json from dir_path.
 * Returns the parsed tree (caller must cJSON_Delete) or NULL on failure,
 * recording the failure reason in result.
 */
static cJSON* read_manifest_json(const char* dir_path, ValidationResult* result) {
    char manifest_path[MAX_PATH_LEN];
    snprintf(manifest_path, sizeof(manifest_path), "%s/manifest.json", dir_path);

    FILE* f = fopen(manifest_path, "r");
    if (!f) {
        add_error(result, "manifest.json not found");
        return NULL;
    }

    fseek(f, 0, SEEK_END);
    long fsize = ftell(f);
    fseek(f, 0, SEEK_SET);

    if (fsize <= 0) {
        fclose(f);
        add_error(result, "manifest.json is empty or unreadable");
        return NULL;
    }
    char* content = malloc((size_t)fsize + 1);
    if (!content) { fclose(f); return NULL; }
    fread(content, 1, fsize, f);
    content[fsize] = '\0';
    fclose(f);

    cJSON* json = cJSON_Parse(content);
    free(content);

    if (!json) {
        add_error(result, "manifest.json is invalid JSON");
        return NULL;
    }

    return json;
}

/*
 * Validate manifest.json.
 * On success returns the parsed manifest tree (caller must cJSON_Delete),
 * so callers that need the manifest content do not re-read the file.
 * On validation failure returns NULL with errors recorded in result.
 */
static cJSON* validate_manifest(const char* dir_path, ValidationResult* result) {
    cJSON* json = read_manifest_json(dir_path, result);
    if (!json) {
        return NULL;
    }

    /* Validate required fields */
    cJSON* name = cJSON_GetObjectItem(json, "name");
    if (!name || !cJSON_IsString(name) || strlen(name->valuestring) == 0) {
        add_error(result, "manifest.json: missing or empty 'name' field");
    }

    cJSON* version = cJSON_GetObjectItem(json, "version");
    if (!version || !cJSON_IsString(version)) {
        add_error(result, "manifest.json: missing 'version' field");
    }

    cJSON* entry_script = cJSON_GetObjectItem(json, "entry_script");
    if (!entry_script || !cJSON_IsString(entry_script)) {
        add_error(result, "manifest.json: missing 'entry_script' field");
    } else if (path_escapes_package_dir(entry_script->valuestring)) {
        /* CR-02: entry_script is the one manifest field do_create() actually
         * fopen()s/reads and compiles — it must be traversal-checked exactly
         * like assets/libraries below, and BEFORE the existence check. */
        char error[MAX_PATH_LEN + 64];
        snprintf(error, sizeof(error), "entry_script '%s' escapes the package directory", entry_script->valuestring);
        add_error(result, error);
    } else {
        /* Check entry script exists */
        char script_path[MAX_PATH_LEN];
        snprintf(script_path, sizeof(script_path), "%s/%s", dir_path, entry_script->valuestring);
        if (!pkg_file_exists(script_path)) {
            char error[MAX_PATH_LEN + 64];
            snprintf(error, sizeof(error), "entry_script '%s' does not exist", entry_script->valuestring);
            add_error(result, error);
        }
    }

    /* Validate optional assets object */
    cJSON* assets = cJSON_GetObjectItem(json, "assets");
    if (assets && cJSON_IsObject(assets)) {
        const char* categories[] = {"models", "textures", "audio", "scripts"};
        for (int i = 0; i < 4; i++) {
            cJSON* category = cJSON_GetObjectItem(assets, categories[i]);
            if (category && cJSON_IsArray(category)) {
                cJSON* asset;
                cJSON_ArrayForEach(asset, category) {
                    if (!cJSON_IsString(asset)) {
                        char error[128];
                        snprintf(error, sizeof(error), "assets.%s contains non-string entry", categories[i]);
                        add_error(result, error);
                        continue;
                    }

                    if (path_escapes_package_dir(asset->valuestring)) {
                        char error[MAX_PATH_LEN + 64];
                        snprintf(error, sizeof(error), "asset '%s' escapes the package directory", asset->valuestring);
                        add_error(result, error);
                        continue;
                    }

                    char asset_path[MAX_PATH_LEN];
                    snprintf(asset_path, sizeof(asset_path), "%s/%s", dir_path, asset->valuestring);
                    if (!pkg_file_exists(asset_path)) {
                        char error[MAX_PATH_LEN + 64];
                        snprintf(error, sizeof(error), "asset '%s' does not exist", asset->valuestring);
                        add_error(result, error);
                    }
                }
            }
        }
    }

    /* Validate optional libraries array (PROTO-10) */
    cJSON* libraries = cJSON_GetObjectItem(json, "libraries");
    if (libraries && cJSON_IsArray(libraries)) {
        cJSON* lib;
        cJSON_ArrayForEach(lib, libraries) {
            if (!cJSON_IsString(lib)) {
                add_error(result, "libraries array contains non-string entry");
                continue;
            }

            if (path_escapes_package_dir(lib->valuestring)) {
                char error[MAX_PATH_LEN + 64];
                snprintf(error, sizeof(error), "library '%s' escapes the package directory", lib->valuestring);
                add_error(result, error);
                continue;
            }

            char lib_path[MAX_PATH_LEN];
            snprintf(lib_path, sizeof(lib_path), "%s/%s", dir_path, lib->valuestring);
            if (!pkg_file_exists(lib_path)) {
                char error[MAX_PATH_LEN + 64];
                snprintf(error, sizeof(error), "library '%s' does not exist", lib->valuestring);
                add_error(result, error);
            }
        }
    }

    /* Validate optional gps_bounds object */
    cJSON* gps_bounds = cJSON_GetObjectItem(json, "gps_bounds");
    if (gps_bounds && cJSON_IsObject(gps_bounds)) {
        cJSON* center = cJSON_GetObjectItem(gps_bounds, "center");
        if (!center || !cJSON_IsObject(center)) {
            add_error(result, "gps_bounds: missing or invalid 'center' object");
        } else {
            cJSON* lat = cJSON_GetObjectItem(center, "lat");
            cJSON* lon = cJSON_GetObjectItem(center, "lon");
            if (!lat || !cJSON_IsNumber(lat)) {
                add_error(result, "gps_bounds.center: missing or invalid 'lat'");
            }
            if (!lon || !cJSON_IsNumber(lon)) {
                add_error(result, "gps_bounds.center: missing or invalid 'lon'");
            }
        }

        cJSON* radius = cJSON_GetObjectItem(gps_bounds, "radius_meters");
        if (!radius || !cJSON_IsNumber(radius)) {
            add_error(result, "gps_bounds: missing or invalid 'radius_meters'");
        }
    }

    if (result->error_count > 0) {
        cJSON_Delete(json);
        return NULL;
    }
    return json;
}

/* Add file to zip archive. running_total tracks cumulative uncompressed
 * content bytes added to the package so far; the add is refused before
 * ever calling mz_zip_writer_add_mem if it would push the package over
 * PACKAGE_SIZE_CAP_BYTES (fail-closed size-cap enforcement, SI-1). */
static int add_file_to_zip(mz_zip_archive* zip, const char* file_path, const char* archive_path, size_t* running_total) {
    FILE* f = fopen(file_path, "rb");
    if (!f) {
        fprintf(stderr, "Failed to open file: %s\n", file_path);
        return 0;
    }

    fseek(f, 0, SEEK_END);
    long fsize = ftell(f);
    fseek(f, 0, SEEK_SET);

    if (fsize <= 0) {
        fclose(f);
        fprintf(stderr, "Error: empty or unreadable file: %s\n", file_path);
        return 0;
    }

    if (is_over_size_cap(*running_total + (size_t)fsize)) {
        fclose(f);
        fprintf(stderr, "Error: package exceeds the 50 MB size limit while adding '%s'\n", archive_path);
        return 0;
    }

    void* data = malloc((size_t)fsize);
    if (!data) { fclose(f); return 0; }
    fread(data, 1, fsize, f);
    fclose(f);

    mz_bool success = mz_zip_writer_add_mem(zip, archive_path, data, fsize, MZ_DEFAULT_COMPRESSION);
    free(data);

    if (!success) {
        fprintf(stderr, "Failed to add file to zip: %s\n", archive_path);
        return 0;
    }

    *running_total += (size_t)fsize;
    return 1;
}

/* Recursively add directory to zip */
static int add_directory_to_zip(mz_zip_archive* zip, const char* base_path, const char* rel_prefix, size_t* running_total) {
    DIR* dir = opendir(base_path);
    if (!dir) {
        fprintf(stderr, "Failed to open directory: %s\n", base_path);
        return 0;
    }

    struct dirent* entry;
    while ((entry = readdir(dir)) != NULL) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) {
            continue;
        }

        char full_path[MAX_PATH_LEN];
        snprintf(full_path, sizeof(full_path), "%s/%s", base_path, entry->d_name);

        char archive_path[MAX_PATH_LEN];
        if (rel_prefix && strlen(rel_prefix) > 0) {
            snprintf(archive_path, sizeof(archive_path), "%s/%s", rel_prefix, entry->d_name);
        } else {
            snprintf(archive_path, sizeof(archive_path), "%s", entry->d_name);
        }

        struct stat st;
        if (stat(full_path, &st) != 0) {
            continue;
        }

        if (S_ISDIR(st.st_mode)) {
            if (!add_directory_to_zip(zip, full_path, archive_path, running_total)) {
                closedir(dir);
                return 0;
            }
        } else if (S_ISREG(st.st_mode)) {
            if (!add_file_to_zip(zip, full_path, archive_path, running_total)) {
                closedir(dir);
                return 0;
            }
        }
    }

    closedir(dir);
    return 1;
}

/* Optional classes callback — Aria runtime classes registered by VM at runtime */
static const char **aria_optional_classes(void *xdata) {
    (void)xdata;
    static const char *classes[] = {"Aria", "GPS", "Input", "Audio", "Material", "Light", NULL};
    return classes;
}

/* Error callback for Gravity compiler */
static void gravity_error_cb(gravity_vm *vm, error_type_t error_type,
                              const char *description, error_desc_t error_desc,
                              void *xdata) {
    (void)vm;
    (void)error_type;
    CompileContext *ctx = (CompileContext *)xdata;
    ctx->had_error = 1;
    fprintf(stderr, "  %s:%d:%d: error: %s\n",
            ctx->src_path, error_desc.lineno, error_desc.colno, description);
}

/*
 * Compile a single .grav source file to a JSON bytecode string.
 * Returns a malloc'd string the caller must free, or NULL on error.
 */
static char *compile_grav_script(const char *src_path) {
    /* Read source file */
    FILE *f = fopen(src_path, "r");
    if (!f) {
        fprintf(stderr, "Failed to open script: %s\n", src_path);
        return NULL;
    }

    fseek(f, 0, SEEK_END);
    long fsize = ftell(f);
    fseek(f, 0, SEEK_SET);

    char *source = malloc(fsize + 1);
    fread(source, 1, fsize, f);
    source[fsize] = '\0';
    fclose(f);

    /* Set up compile context and delegate */
    CompileContext ctx = { 0, src_path };
    gravity_delegate_t delegate;
    memset(&delegate, 0, sizeof(delegate));
    delegate.xdata = &ctx;
    delegate.error_callback = gravity_error_cb;
    delegate.optional_classes = aria_optional_classes;

    /* Create compiler and run */
    gravity_compiler_t *compiler = gravity_compiler_create(&delegate);
    // gravity_compiler_run takes ownership of source (is_static=false) and frees it via gravity_lexer_free
    gravity_closure_t *closure = gravity_compiler_run(compiler, source, (size_t)fsize, 0, false, false);

    if (!closure || ctx.had_error) {
        gravity_compiler_free(compiler);
        return NULL;
    }

    /* Serialize to JSON bytecode */
    json_t *json = gravity_compiler_serialize(compiler, closure);
    gravity_compiler_free(compiler);  /* also frees closure */

    if (!json) {
        fprintf(stderr, "Failed to serialize bytecode for: %s\n", src_path);
        return NULL;
    }

    size_t json_len = 0;
    char *json_buf = json_buffer(json, &json_len);
    char *result = strdup(json_buf);
    json_free(json);

    return result;
}

/*
 * Compile all .grav scripts in base_path, adding .gbc files to zip.
 * Non-.grav files are added as-is.
 * entry_script: manifest entry_script value (e.g. "scripts/foo.grav")
 * compiled_entry: output buffer (MAX_PATH_LEN) receiving compiled name
 * Returns 1 on success, 0 on error.
 */
static int compile_scripts_dir(mz_zip_archive *zip, const char *base_path,
                                const char *entry_script, char *compiled_entry,
                                size_t *running_total) {
    DIR *dir = opendir(base_path);
    if (!dir) {
        /* No scripts directory is not an error */
        return 1;
    }

    struct dirent *entry;
    while ((entry = readdir(dir)) != NULL) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) {
            continue;
        }

        char full_path[MAX_PATH_LEN];
        snprintf(full_path, sizeof(full_path), "%s/%s", base_path, entry->d_name);

        struct stat st;
        if (stat(full_path, &st) != 0 || !S_ISREG(st.st_mode)) {
            continue;
        }

        /* Check for .grav extension */
        const char *ext = strrchr(entry->d_name, '.');
        if (ext && strcmp(ext, ".grav") == 0) {
            printf("  Compiling %s...\n", entry->d_name);

            char *bytecode = compile_grav_script(full_path);
            if (!bytecode) {
                fprintf(stderr, "Compilation failed: %s\n", full_path);
                closedir(dir);
                return 0;
            }

            /* Build archive path with .gbc extension */
            size_t base_len = (size_t)(ext - entry->d_name);
            char base_name[MAX_PATH_LEN];
            strncpy(base_name, entry->d_name, base_len);
            base_name[base_len] = '\0';

            char archive_path[MAX_PATH_LEN];
            snprintf(archive_path, sizeof(archive_path), "scripts/%s.gbc", base_name);

            /* Check if this is the entry script */
            if (entry_script) {
                char expected[MAX_PATH_LEN];
                snprintf(expected, sizeof(expected), "scripts/%s.grav", base_name);
                if (strcmp(entry_script, expected) == 0) {
                    strncpy(compiled_entry, archive_path, MAX_PATH_LEN - 1);
                    compiled_entry[MAX_PATH_LEN - 1] = '\0';
                }
            }

            size_t bytecode_len = strlen(bytecode);
            if (is_over_size_cap(*running_total + bytecode_len)) {
                fprintf(stderr, "Error: package exceeds the 50 MB size limit while adding '%s'\n", archive_path);
                free(bytecode);
                closedir(dir);
                return 0;
            }

            mz_bool ok = mz_zip_writer_add_mem(zip, archive_path,
                                                bytecode, bytecode_len,
                                                MZ_DEFAULT_COMPRESSION);
            free(bytecode);
            if (!ok) {
                fprintf(stderr, "Failed to add compiled script to zip: %s\n", archive_path);
                closedir(dir);
                return 0;
            }
            *running_total += bytecode_len;
        } else {
            /* Non-.grav file: add as-is */
            char archive_path[MAX_PATH_LEN];
            snprintf(archive_path, sizeof(archive_path), "scripts/%s", entry->d_name);
            if (!add_file_to_zip(zip, full_path, archive_path, running_total)) {
                closedir(dir);
                return 0;
            }
        }
    }

    closedir(dir);
    return 1;
}

/* Create world package */
static int do_create(const char* dir_path, const char* output_path) {
    ValidationResult result = {0};

    printf("Validating manifest...\n");
    /* validate_manifest returns the parsed tree on success — reuse it below
     * for output path and entry_script instead of re-reading the file. */
    cJSON* manifest_json = validate_manifest(dir_path, &result);
    if (!manifest_json) {
        fprintf(stderr, "Validation failed:\n");
        for (int i = 0; i < result.error_count; i++) {
            fprintf(stderr, "  - %s\n", result.errors[i]);
        }
        free_validation_result(&result);
        return 1;
    }
    free_validation_result(&result);

    /* Determine output path */
    char final_output[MAX_PATH_LEN];
    if (output_path) {
        snprintf(final_output, sizeof(final_output), "%s", output_path);
    } else {
        cJSON* name = cJSON_GetObjectItem(manifest_json, "name");
        if (!name || !name->valuestring) {
            fprintf(stderr, "Error: manifest.json missing required 'name' field\n");
            cJSON_Delete(manifest_json); return 1;
        }
        snprintf(final_output, sizeof(final_output), "%s.therd", name->valuestring);
    }

    printf("Creating package: %s\n", final_output);

    /* Initialize zip archive */
    mz_zip_archive zip;
    memset(&zip, 0, sizeof(zip));

    if (!mz_zip_writer_init_file(&zip, final_output, 0)) {
        fprintf(stderr, "Failed to create zip file: %s\n", final_output);
        cJSON_Delete(manifest_json);
        return 1;
    }

    /* Running total of uncompressed content bytes added so far — enforces
     * the documented 50 MB package size cap (SI-1) fail-closed, before the
     * archive is finalized. */
    size_t package_size_accum = 0;

    /* Compile scripts/ directory */
    char scripts_path[MAX_PATH_LEN];
    snprintf(scripts_path, sizeof(scripts_path), "%s/scripts", dir_path);
    struct stat st;
    char compiled_entry[MAX_PATH_LEN] = {0};
    cJSON* entry_script_item = cJSON_GetObjectItem(manifest_json, "entry_script");

    if (stat(scripts_path, &st) == 0 && S_ISDIR(st.st_mode)) {
        printf("Compiling scripts/...\n");

        const char *entry_script_val = entry_script_item ? entry_script_item->valuestring : NULL;

        /* Initialize Gravity core (idempotent) */
        gravity_core_init();

        if (!compile_scripts_dir(&zip, scripts_path, entry_script_val, compiled_entry, &package_size_accum)) {
            mz_zip_writer_end(&zip);
            cJSON_Delete(manifest_json);
            remove(final_output);
            return 1;
        }

        /* Update entry_script in manifest from .grav to .gbc */
        if (entry_script_item && compiled_entry[0] != '\0') {
            cJSON_DeleteItemFromObject(manifest_json, "entry_script");
            cJSON_AddStringToObject(manifest_json, "entry_script", compiled_entry);
        }
    }

    /* Compile root-level entry script if not already compiled from scripts/ dir */
    if (compiled_entry[0] == '\0' && entry_script_item && entry_script_item->valuestring) {
        const char *entry_val = entry_script_item->valuestring;
        const char *ext = strrchr(entry_val, '.');
        if (ext && strcmp(ext, ".grav") == 0) {
            char entry_full[MAX_PATH_LEN];
            snprintf(entry_full, sizeof(entry_full), "%s/%s", dir_path, entry_val);

            if (pkg_file_exists(entry_full)) {
                printf("Compiling root entry script: %s\n", entry_val);

                gravity_core_init();
                char *bytecode = compile_grav_script(entry_full);
                if (!bytecode) {
                    fprintf(stderr, "Compilation failed: %s\n", entry_full);
                    mz_zip_writer_end(&zip);
                    cJSON_Delete(manifest_json);
                    remove(final_output);
                    return 1;
                }

                /* Build .gbc archive path */
                size_t base_len = (size_t)(ext - entry_val);
                char gbc_name[MAX_PATH_LEN];
                strncpy(gbc_name, entry_val, base_len);
                gbc_name[base_len] = '\0';
                strncat(gbc_name, ".gbc", sizeof(gbc_name) - strlen(gbc_name) - 1);

                size_t bytecode_len = strlen(bytecode);
                if (is_over_size_cap(package_size_accum + bytecode_len)) {
                    fprintf(stderr, "Error: package exceeds the 50 MB size limit while adding '%s'\n", gbc_name);
                    free(bytecode);
                    mz_zip_writer_end(&zip);
                    cJSON_Delete(manifest_json);
                    remove(final_output);
                    return 1;
                }

                mz_bool ok2 = mz_zip_writer_add_mem(&zip, gbc_name,
                                                     bytecode, bytecode_len,
                                                     MZ_DEFAULT_COMPRESSION);
                free(bytecode);
                if (!ok2) {
                    fprintf(stderr, "Failed to add compiled entry script to zip\n");
                    mz_zip_writer_end(&zip);
                    cJSON_Delete(manifest_json);
                    remove(final_output);
                    return 1;
                }
                package_size_accum += bytecode_len;

                /* Update manifest entry_script */
                cJSON_DeleteItemFromObject(manifest_json, "entry_script");
                cJSON_AddStringToObject(manifest_json, "entry_script", gbc_name);
            }
        }
    }

    /* Serialize updated manifest and add to zip */
    char *updated_manifest = cJSON_PrintUnformatted(manifest_json);
    cJSON_Delete(manifest_json);

    size_t manifest_len = strlen(updated_manifest);
    if (is_over_size_cap(package_size_accum + manifest_len)) {
        fprintf(stderr, "Error: package exceeds the 50 MB size limit while adding 'manifest.json'\n");
        free(updated_manifest);
        mz_zip_writer_end(&zip);
        remove(final_output);
        return 1;
    }

    mz_bool ok = mz_zip_writer_add_mem(&zip, "manifest.json",
                                        updated_manifest, manifest_len,
                                        MZ_DEFAULT_COMPRESSION);
    free(updated_manifest);
    if (!ok) {
        fprintf(stderr, "Failed to add manifest.json to zip\n");
        mz_zip_writer_end(&zip);
        remove(final_output);
        return 1;
    }
    package_size_accum += manifest_len;

    /* Add assets/ directory — includes models/, audio/, textures/, fonts/ subdirs.
     * Blender addon writes GLBs to assets/models/; all non-script assets land here. */
    char assets_path[MAX_PATH_LEN];
    snprintf(assets_path, sizeof(assets_path), "%s/assets", dir_path);
    if (stat(assets_path, &st) == 0 && S_ISDIR(st.st_mode)) {
        printf("Adding assets/...\n");
        if (!add_directory_to_zip(&zip, assets_path, "assets", &package_size_accum)) {
            mz_zip_writer_end(&zip);
            remove(final_output);
            return 1;
        }
    }

    /* Finalize zip */
    if (!mz_zip_writer_finalize_archive(&zip)) {
        fprintf(stderr, "Failed to finalize zip archive\n");
        mz_zip_writer_end(&zip);
        remove(final_output);
        return 1;
    }

    mz_zip_writer_end(&zip);

    /* Print summary */
    if (stat(final_output, &st) == 0) {
        printf("Package created successfully\n");
        printf("  Output: %s\n", final_output);
        printf("  Size: %ld bytes\n", st.st_size);
    }

    return 0;
}

/* Validate world directory */
static int do_validate(const char* dir_path) {
    ValidationResult result = {0};

    cJSON* manifest = validate_manifest(dir_path, &result);
    if (manifest) {
        cJSON_Delete(manifest);
        printf("Valid\n");
        free_validation_result(&result);
        return 0;
    } else {
        fprintf(stderr, "Validation failed:\n");
        for (int i = 0; i < result.error_count; i++) {
            fprintf(stderr, "  - %s\n", result.errors[i]);
        }
        free_validation_result(&result);
        return 1;
    }
}

/* Print usage */
static void print_usage(const char* prog) {
    printf("therd-package v%s - World packaging tool for THerD Platform\n\n", VERSION);
    printf("Usage: %s <command> [options]\n\n", prog);
    printf("Commands:\n");
    printf("  create    Create world package from directory\n");
    printf("  validate  Validate manifest.json without packaging\n\n");
    printf("Create options:\n");
    printf("  --dir <path>       World directory (contains manifest.json, scripts/, assets/)\n");
    printf("  --output <path>    Output zip file path (default: <world-name>.therd)\n\n");
    printf("Validate options:\n");
    printf("  --dir <path>       World directory to validate\n\n");
    printf("To upload a created package to a world server, use curl directly, e.g.:\n");
    printf("  curl -X POST <server-url>/world --data-binary @<package>.therd \\\n");
    printf("       -H 'Content-Type: application/octet-stream'\n");
}

/* main() is compiled out under THERD_PACKAGE_TEST_BUILD so
 * tests/unit/test_therd_package.c can #include this file directly (to
 * reach its static functions) and supply its own main(). */
#ifndef THERD_PACKAGE_TEST_BUILD
int main(int argc, char** argv) {
    if (argc < 2) {
        print_usage(argv[0]);
        return 1;
    }

    const char* command = argv[1];
    const char* dir_path = NULL;
    const char* output_path = NULL;

    /* Parse arguments */
    for (int i = 2; i < argc; i++) {
        if (strcmp(argv[i], "--dir") == 0 && i + 1 < argc) {
            dir_path = argv[++i];
        } else if (strcmp(argv[i], "--output") == 0 && i + 1 < argc) {
            output_path = argv[++i];
        }
    }

    /* Dispatch to command */
    if (strcmp(command, "validate") == 0) {
        if (!dir_path) {
            fprintf(stderr, "Error: --dir is required\n\n");
            print_usage(argv[0]);
            return 1;
        }
        return do_validate(dir_path);
    } else if (strcmp(command, "create") == 0) {
        if (!dir_path) {
            fprintf(stderr, "Error: --dir is required\n\n");
            print_usage(argv[0]);
            return 1;
        }
        return do_create(dir_path, output_path);
    } else {
        fprintf(stderr, "Error: unknown command '%s'\n\n", command);
        print_usage(argv[0]);
        return 1;
    }

    return 0;
}
#endif /* !THERD_PACKAGE_TEST_BUILD */
