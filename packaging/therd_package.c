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
#include "miniz.h"

#include "gravity_compiler.h"
#include "gravity_vm.h"
#include "gravity_core.h"
#include "gravity_delegate.h"

#define MAX_PATH_LEN 1024
#define VERSION "0.1.0"

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
static int validate_manifest(const char* dir_path, ValidationResult* result);
static int do_create(const char* dir_path, const char* output_path);
static int do_validate(const char* dir_path);
static void add_error(ValidationResult* result, const char* error);
static void free_validation_result(ValidationResult* result);
static int pkg_file_exists(const char* path);
static int add_directory_to_zip(mz_zip_archive* zip, const char* base_path, const char* rel_prefix);
static int add_file_to_zip(mz_zip_archive* zip, const char* file_path, const char* archive_path);
static char *compile_grav_script(const char* src_path);
static int compile_scripts_dir(mz_zip_archive* zip, const char* base_path, const char* entry_script, char* compiled_entry);

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

/* Validate manifest.json */
static int validate_manifest(const char* dir_path, ValidationResult* result) {
    char manifest_path[MAX_PATH_LEN];
    snprintf(manifest_path, sizeof(manifest_path), "%s/manifest.json", dir_path);

    /* Read manifest file */
    FILE* f = fopen(manifest_path, "r");
    if (!f) {
        add_error(result, "manifest.json not found");
        return 0;
    }

    fseek(f, 0, SEEK_END);
    long fsize = ftell(f);
    fseek(f, 0, SEEK_SET);

    if (fsize <= 0) {
        fclose(f);
        add_error(result, "manifest.json is empty or unreadable");
        return 0;
    }
    char* content = malloc((size_t)fsize + 1);
    if (!content) { fclose(f); return 0; }
    fread(content, 1, fsize, f);
    content[fsize] = '\0';
    fclose(f);

    /* Parse JSON */
    cJSON* json = cJSON_Parse(content);
    free(content);

    if (!json) {
        add_error(result, "manifest.json is invalid JSON");
        return 0;
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

    cJSON_Delete(json);
    return (result->error_count == 0);
}

/* Add file to zip archive */
static int add_file_to_zip(mz_zip_archive* zip, const char* file_path, const char* archive_path) {
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

    return 1;
}

/* Recursively add directory to zip */
static int add_directory_to_zip(mz_zip_archive* zip, const char* base_path, const char* rel_prefix) {
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
            if (!add_directory_to_zip(zip, full_path, archive_path)) {
                closedir(dir);
                return 0;
            }
        } else if (S_ISREG(st.st_mode)) {
            if (!add_file_to_zip(zip, full_path, archive_path)) {
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
                                const char *entry_script, char *compiled_entry) {
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

            mz_bool ok = mz_zip_writer_add_mem(zip, archive_path,
                                                bytecode, strlen(bytecode),
                                                MZ_DEFAULT_COMPRESSION);
            free(bytecode);
            if (!ok) {
                fprintf(stderr, "Failed to add compiled script to zip: %s\n", archive_path);
                closedir(dir);
                return 0;
            }
        } else {
            /* Non-.grav file: add as-is */
            char archive_path[MAX_PATH_LEN];
            snprintf(archive_path, sizeof(archive_path), "scripts/%s", entry->d_name);
            if (!add_file_to_zip(zip, full_path, archive_path)) {
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
    if (!validate_manifest(dir_path, &result)) {
        fprintf(stderr, "Validation failed:\n");
        for (int i = 0; i < result.error_count; i++) {
            fprintf(stderr, "  - %s\n", result.errors[i]);
        }
        free_validation_result(&result);
        return 1;
    }
    free_validation_result(&result);

    /* Read manifest once for output path and entry_script */
    char manifest_path[MAX_PATH_LEN];
    snprintf(manifest_path, sizeof(manifest_path), "%s/manifest.json", dir_path);
    FILE* f = fopen(manifest_path, "r");
    if (!f) { fprintf(stderr, "Error: cannot open %s\n", manifest_path); return 1; }
    fseek(f, 0, SEEK_END);
    long fsize = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (fsize <= 0) {
        fclose(f);
        fprintf(stderr, "Error: empty or unreadable file: %s\n", manifest_path);
        return 1;
    }
    char* manifest_content = malloc((size_t)fsize + 1);
    if (!manifest_content) { fclose(f); return 1; }
    fread(manifest_content, 1, fsize, f);
    manifest_content[fsize] = '\0';
    fclose(f);

    cJSON* manifest_json = cJSON_Parse(manifest_content);
    free(manifest_content);

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

    /* Compile scripts/ directory */
    char scripts_path[MAX_PATH_LEN];
    snprintf(scripts_path, sizeof(scripts_path), "%s/scripts", dir_path);
    struct stat st;
    char compiled_entry[MAX_PATH_LEN] = {0};

    if (stat(scripts_path, &st) == 0 && S_ISDIR(st.st_mode)) {
        printf("Compiling scripts/...\n");

        cJSON* entry_script_item = cJSON_GetObjectItem(manifest_json, "entry_script");
        const char *entry_script_val = entry_script_item ? entry_script_item->valuestring : NULL;

        /* Initialize Gravity core (idempotent) */
        gravity_core_init();

        if (!compile_scripts_dir(&zip, scripts_path, entry_script_val, compiled_entry)) {
            mz_zip_writer_end(&zip);
            cJSON_Delete(manifest_json);
            return 1;
        }

        /* Update entry_script in manifest from .grav to .gbc */
        if (entry_script_item && compiled_entry[0] != '\0') {
            cJSON_DeleteItemFromObject(manifest_json, "entry_script");
            cJSON_AddStringToObject(manifest_json, "entry_script", compiled_entry);
        }
    }

    /* Serialize updated manifest and add to zip */
    char *updated_manifest = cJSON_PrintUnformatted(manifest_json);
    cJSON_Delete(manifest_json);

    mz_bool ok = mz_zip_writer_add_mem(&zip, "manifest.json",
                                        updated_manifest, strlen(updated_manifest),
                                        MZ_DEFAULT_COMPRESSION);
    free(updated_manifest);
    if (!ok) {
        fprintf(stderr, "Failed to add manifest.json to zip\n");
        mz_zip_writer_end(&zip);
        return 1;
    }

    /* Add assets/ directory */
    char assets_path[MAX_PATH_LEN];
    snprintf(assets_path, sizeof(assets_path), "%s/assets", dir_path);
    if (stat(assets_path, &st) == 0 && S_ISDIR(st.st_mode)) {
        printf("Adding assets/...\n");
        if (!add_directory_to_zip(&zip, assets_path, "assets")) {
            mz_zip_writer_end(&zip);
            return 1;
        }
    }

    /* Finalize zip */
    if (!mz_zip_writer_finalize_archive(&zip)) {
        fprintf(stderr, "Failed to finalize zip archive\n");
        mz_zip_writer_end(&zip);
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

    if (validate_manifest(dir_path, &result)) {
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

/* Upload a .therd package to a THerD server */
static int do_upload(const char* package_path, const char* server_url) {
    /* Verify the package file exists */
    if (!pkg_file_exists(package_path)) {
        fprintf(stderr, "Error: package not found: %s\n", package_path);
        return 1;
    }

    printf("Uploading %s to %s ...\n", package_path, server_url);

    /* Build curl command — POST raw bytes, Content-Type: application/octet-stream */
    char cmd[MAX_PATH_LEN * 2 + 256];
    snprintf(cmd, sizeof(cmd),
        "curl -s -w '\\nHTTP %%{http_code}\\n'"
        " -X POST '%s/world'"
        " --data-binary '@%s'"
        " -H 'Content-Type: application/octet-stream'",
        server_url, package_path);

    int ret = system(cmd);
    printf("\n");

    if (ret != 0) {
        fprintf(stderr, "Error: curl failed (is curl installed? is the server running?)\n");
        return 1;
    }

    return 0;
}

/* Print usage */
static void print_usage(const char* prog) {
    printf("therd-package v%s - World packaging tool for THerD Platform\n\n", VERSION);
    printf("Usage: %s <command> [options]\n\n", prog);
    printf("Commands:\n");
    printf("  create    Create world package from directory\n");
    printf("  validate  Validate manifest.json without packaging\n");
    printf("  upload    Upload a .therd package to a world server\n\n");
    printf("Create options:\n");
    printf("  --dir <path>       World directory (contains manifest.json, scripts/, assets/)\n");
    printf("  --output <path>    Output zip file path (default: <world-name>.therd)\n\n");
    printf("Validate options:\n");
    printf("  --dir <path>       World directory to validate\n\n");
    printf("Upload options:\n");
    printf("  --package <path>   Path to .therd file to upload\n");
    printf("  --server <url>     Server URL (default: http://localhost:3000)\n");
}

int main(int argc, char** argv) {
    if (argc < 2) {
        print_usage(argv[0]);
        return 1;
    }

    const char* command = argv[1];
    const char* dir_path = NULL;
    const char* output_path = NULL;
    const char* package_path = NULL;
    const char* server_url = "http://localhost:3000";

    /* Parse arguments */
    for (int i = 2; i < argc; i++) {
        if (strcmp(argv[i], "--dir") == 0 && i + 1 < argc) {
            dir_path = argv[++i];
        } else if (strcmp(argv[i], "--output") == 0 && i + 1 < argc) {
            output_path = argv[++i];
        } else if (strcmp(argv[i], "--package") == 0 && i + 1 < argc) {
            package_path = argv[++i];
        } else if (strcmp(argv[i], "--server") == 0 && i + 1 < argc) {
            server_url = argv[++i];
        }
    }

    /* Dispatch to command */
    if (strcmp(command, "upload") == 0) {
        if (!package_path) {
            fprintf(stderr, "Error: --package is required for upload\n\n");
            print_usage(argv[0]);
            return 1;
        }
        return do_upload(package_path, server_url);
    } else if (strcmp(command, "validate") == 0) {
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
