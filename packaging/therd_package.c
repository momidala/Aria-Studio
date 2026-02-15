/*
 * therd-package - World packaging tool for THerD Platform
 *
 * Creates validated world packages (zip archives) from directory structure.
 * Validates manifest.json schema and checks all referenced files exist.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <dirent.h>
#include <errno.h>
#include "cJSON.h"
#include "miniz.h"

#define MAX_PATH_LEN 1024
#define VERSION "0.1.0"

typedef struct {
    char** errors;
    int error_count;
    int error_capacity;
} ValidationResult;

/* Forward declarations */
static int validate_manifest(const char* dir_path, ValidationResult* result);
static int do_create(const char* dir_path, const char* output_path);
static int do_validate(const char* dir_path);
static void add_error(ValidationResult* result, const char* error);
static void free_validation_result(ValidationResult* result);
static int file_exists(const char* path);
static int add_directory_to_zip(mz_zip_archive* zip, const char* base_path, const char* rel_prefix);
static int add_file_to_zip(mz_zip_archive* zip, const char* file_path, const char* archive_path);

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
static int file_exists(const char* path) {
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

    char* content = malloc(fsize + 1);
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
        if (!file_exists(script_path)) {
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
                    if (!file_exists(asset_path)) {
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
            if (!file_exists(lib_path)) {
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

    void* data = malloc(fsize);
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

    /* Determine output path */
    char final_output[MAX_PATH_LEN];
    if (output_path) {
        snprintf(final_output, sizeof(final_output), "%s", output_path);
    } else {
        /* Read manifest to get world name */
        char manifest_path[MAX_PATH_LEN];
        snprintf(manifest_path, sizeof(manifest_path), "%s/manifest.json", dir_path);
        FILE* f = fopen(manifest_path, "r");
        fseek(f, 0, SEEK_END);
        long fsize = ftell(f);
        fseek(f, 0, SEEK_SET);
        char* content = malloc(fsize + 1);
        fread(content, 1, fsize, f);
        content[fsize] = '\0';
        fclose(f);

        cJSON* json = cJSON_Parse(content);
        free(content);
        cJSON* name = cJSON_GetObjectItem(json, "name");
        snprintf(final_output, sizeof(final_output), "%s.therd", name->valuestring);
        cJSON_Delete(json);
    }

    printf("Creating package: %s\n", final_output);

    /* Initialize zip archive */
    mz_zip_archive zip;
    memset(&zip, 0, sizeof(zip));

    if (!mz_zip_writer_init_file(&zip, final_output, 0)) {
        fprintf(stderr, "Failed to create zip file: %s\n", final_output);
        return 1;
    }

    /* Add manifest.json */
    char manifest_path[MAX_PATH_LEN];
    snprintf(manifest_path, sizeof(manifest_path), "%s/manifest.json", dir_path);
    if (!add_file_to_zip(&zip, manifest_path, "manifest.json")) {
        mz_zip_writer_end(&zip);
        return 1;
    }

    /* Add scripts/ directory */
    char scripts_path[MAX_PATH_LEN];
    snprintf(scripts_path, sizeof(scripts_path), "%s/scripts", dir_path);
    struct stat st;
    if (stat(scripts_path, &st) == 0 && S_ISDIR(st.st_mode)) {
        printf("Adding scripts/...\n");
        if (!add_directory_to_zip(&zip, scripts_path, "scripts")) {
            mz_zip_writer_end(&zip);
            return 1;
        }
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
    printf("  --dir <path>       World directory to validate\n");
}

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

    if (!dir_path) {
        fprintf(stderr, "Error: --dir is required\n\n");
        print_usage(argv[0]);
        return 1;
    }

    /* Dispatch to command */
    if (strcmp(command, "validate") == 0) {
        return do_validate(dir_path);
    } else if (strcmp(command, "create") == 0) {
        return do_create(dir_path, output_path);
    } else {
        fprintf(stderr, "Error: unknown command '%s'\n\n", command);
        print_usage(argv[0]);
        return 1;
    }

    return 0;
}
