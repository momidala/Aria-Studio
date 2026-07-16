/*
 * Tier 1 unit tests for Aria-Studio's world packaging tool (therd_package.c).
 *
 * Covers SI-1 (Phase 27.9-03):
 *   - validate_manifest() rejects asset/library paths that escape the
 *     package directory ("..", a leading '/', or a backslash).
 *   - validate_manifest() still accepts a clean, existing asset path.
 *   - is_over_size_cap(), the pure helper backing do_create()'s 50 MB
 *     package size cap, is correct at and around the boundary.
 *
 * Covers CR-02 (Phase 27.9 review remediation):
 *   - validate_manifest() rejects a traversal entry_script value the same
 *     way it rejects traversal asset/library paths (entry_script is the
 *     one manifest field do_create() actually fopen()s/reads and compiles).
 *   - validate_manifest() still accepts a legitimate relative subpath
 *     entry_script (e.g. "scripts/main.grav").
 *
 * therd_package.c has no separate library target — its functions are all
 * `static`. THERD_PACKAGE_TEST_BUILD compiles out therd_package.c's own
 * main() (see the #ifndef guard at the bottom of that file) so this file
 * can #include it directly and supply its own main() for the test runner.
 * This is the same "static functions, no header" shape as the rest of the
 * packager, so it needs no new test framework beyond a minimal
 * assert-and-count-failures harness.
 */

#define THERD_PACKAGE_TEST_BUILD
#include "../../packaging/therd_package.c"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/stat.h>

static int g_failures = 0;

#define ASSERT_TRUE(cond, msg) \
    do { \
        if (!(cond)) { \
            fprintf(stderr, "FAIL: %s (%s:%d)\n", (msg), __FILE__, __LINE__); \
            g_failures++; \
        } \
    } while (0)

#define ASSERT_FALSE(cond, msg) ASSERT_TRUE(!(cond), msg)

/* --- fixture helpers --- */

static void write_file(const char* path, const char* content) {
    FILE* f = fopen(path, "w");
    if (!f) {
        ASSERT_TRUE(0, "setup: failed to write fixture file");
        return;
    }
    fputs(content, f);
    fclose(f);
}

/* Creates a temp world dir with an entry_script (scripts/main.grav is not
 * used here — the entry script is placed at "main.grav" directly under the
 * temp dir) and writes the given manifest.json content into it. */
static void make_manifest_dir(char* tmp_dir, size_t tmp_dir_sz, const char* manifest_json) {
    snprintf(tmp_dir, tmp_dir_sz, "/tmp/therd_pkg_test_XXXXXX");
    if (!mkdtemp(tmp_dir)) {
        ASSERT_TRUE(0, "setup: mkdtemp failed");
        return;
    }

    char entry_path[MAX_PATH_LEN];
    snprintf(entry_path, sizeof(entry_path), "%s/main.grav", tmp_dir);
    write_file(entry_path, "func main() {}\n");

    char manifest_path[MAX_PATH_LEN];
    snprintf(manifest_path, sizeof(manifest_path), "%s/manifest.json", tmp_dir);
    write_file(manifest_path, manifest_json);
}

static void cleanup_dir(const char* tmp_dir) {
    char path[MAX_PATH_LEN];
    snprintf(path, sizeof(path), "%s/main.grav", tmp_dir);
    remove(path);
    snprintf(path, sizeof(path), "%s/manifest.json", tmp_dir);
    remove(path);
    rmdir(tmp_dir);
}

/* --- traversal tests (SI-1) --- */

static void test_asset_relative_traversal_rejected(void) {
    char tmp_dir[256];
    make_manifest_dir(tmp_dir, sizeof(tmp_dir),
        "{\"name\":\"t\",\"version\":\"1.0\",\"entry_script\":\"main.grav\","
        "\"assets\":{\"textures\":[\"../x\"]}}");

    ValidationResult result = {0};
    cJSON* json = validate_manifest(tmp_dir, &result);
    ASSERT_TRUE(json == NULL, "traversal '../x' should fail validation");
    ASSERT_TRUE(result.error_count > 0, "traversal '../x' should record an error");

    int found = 0;
    for (int i = 0; i < result.error_count; i++) {
        if (strstr(result.errors[i], "escapes the package directory")) found = 1;
    }
    ASSERT_TRUE(found, "traversal error message should say 'escapes the package directory'");

    if (json) cJSON_Delete(json);
    free_validation_result(&result);
    cleanup_dir(tmp_dir);
}

static void test_asset_absolute_path_rejected(void) {
    char tmp_dir[256];
    make_manifest_dir(tmp_dir, sizeof(tmp_dir),
        "{\"name\":\"t\",\"version\":\"1.0\",\"entry_script\":\"main.grav\","
        "\"assets\":{\"textures\":[\"/etc/passwd\"]}}");

    ValidationResult result = {0};
    cJSON* json = validate_manifest(tmp_dir, &result);
    ASSERT_TRUE(json == NULL, "absolute path '/etc/passwd' should fail validation");
    ASSERT_TRUE(result.error_count > 0, "absolute path should record an error");

    if (json) cJSON_Delete(json);
    free_validation_result(&result);
    cleanup_dir(tmp_dir);
}

static void test_library_traversal_rejected(void) {
    char tmp_dir[256];
    make_manifest_dir(tmp_dir, sizeof(tmp_dir),
        "{\"name\":\"t\",\"version\":\"1.0\",\"entry_script\":\"main.grav\","
        "\"libraries\":[\"../../x\"]}");

    ValidationResult result = {0};
    cJSON* json = validate_manifest(tmp_dir, &result);
    ASSERT_TRUE(json == NULL, "library traversal '../../x' should fail validation");
    ASSERT_TRUE(result.error_count > 0, "library traversal should record an error");

    int found = 0;
    for (int i = 0; i < result.error_count; i++) {
        if (strstr(result.errors[i], "escapes the package directory")) found = 1;
    }
    ASSERT_TRUE(found, "library traversal error message should say 'escapes the package directory'");

    if (json) cJSON_Delete(json);
    free_validation_result(&result);
    cleanup_dir(tmp_dir);
}

static void test_clean_asset_passes_traversal_check(void) {
    char tmp_dir[256];
    snprintf(tmp_dir, sizeof(tmp_dir), "/tmp/therd_pkg_test_XXXXXX");
    if (!mkdtemp(tmp_dir)) {
        ASSERT_TRUE(0, "setup: mkdtemp failed");
        return;
    }

    char entry_path[MAX_PATH_LEN];
    snprintf(entry_path, sizeof(entry_path), "%s/main.grav", tmp_dir);
    write_file(entry_path, "func main() {}\n");

    /* Clean asset must actually exist under dir_path for pkg_file_exists to
     * pass, so validate_manifest fully succeeds (not just the traversal
     * check). */
    char textures_dir[MAX_PATH_LEN];
    snprintf(textures_dir, sizeof(textures_dir), "%s/textures", tmp_dir);
    mkdir(textures_dir, 0755);

    char asset_path[MAX_PATH_LEN];
    snprintf(asset_path, sizeof(asset_path), "%s/wall.png", textures_dir);
    write_file(asset_path, "fake-png-bytes");

    char manifest_path[MAX_PATH_LEN];
    snprintf(manifest_path, sizeof(manifest_path), "%s/manifest.json", tmp_dir);
    write_file(manifest_path,
        "{\"name\":\"t\",\"version\":\"1.0\",\"entry_script\":\"main.grav\","
        "\"assets\":{\"textures\":[\"textures/wall.png\"]}}");

    ValidationResult result = {0};
    cJSON* json = validate_manifest(tmp_dir, &result);
    ASSERT_TRUE(json != NULL, "clean asset 'textures/wall.png' should pass validation");
    ASSERT_TRUE(result.error_count == 0, "clean asset should record zero errors");

    if (json) cJSON_Delete(json);
    free_validation_result(&result);
    remove(asset_path);
    rmdir(textures_dir);
    remove(entry_path);
    remove(manifest_path);
    rmdir(tmp_dir);
}

static void test_entry_script_traversal_rejected(void) {
    char tmp_dir[256];
    make_manifest_dir(tmp_dir, sizeof(tmp_dir),
        "{\"name\":\"t\",\"version\":\"1.0\","
        "\"entry_script\":\"../../../../home/user/.ssh/id_rsa\"}");

    ValidationResult result = {0};
    cJSON* json = validate_manifest(tmp_dir, &result);
    ASSERT_TRUE(json == NULL, "traversal entry_script should fail validation");
    ASSERT_TRUE(result.error_count > 0, "traversal entry_script should record an error");

    int found = 0;
    for (int i = 0; i < result.error_count; i++) {
        if (strstr(result.errors[i], "escapes the package directory")) found = 1;
    }
    ASSERT_TRUE(found, "entry_script traversal error message should say 'escapes the package directory'");

    if (json) cJSON_Delete(json);
    free_validation_result(&result);
    cleanup_dir(tmp_dir);
}

static void test_entry_script_legitimate_path_accepted(void) {
    char tmp_dir[256];
    snprintf(tmp_dir, sizeof(tmp_dir), "/tmp/therd_pkg_test_XXXXXX");
    if (!mkdtemp(tmp_dir)) {
        ASSERT_TRUE(0, "setup: mkdtemp failed");
        return;
    }

    char scripts_dir[MAX_PATH_LEN];
    snprintf(scripts_dir, sizeof(scripts_dir), "%s/scripts", tmp_dir);
    mkdir(scripts_dir, 0755);

    char entry_path[MAX_PATH_LEN];
    snprintf(entry_path, sizeof(entry_path), "%s/main.grav", scripts_dir);
    write_file(entry_path, "func main() {}\n");

    char manifest_path[MAX_PATH_LEN];
    snprintf(manifest_path, sizeof(manifest_path), "%s/manifest.json", tmp_dir);
    write_file(manifest_path,
        "{\"name\":\"t\",\"version\":\"1.0\",\"entry_script\":\"scripts/main.grav\"}");

    ValidationResult result = {0};
    cJSON* json = validate_manifest(tmp_dir, &result);
    ASSERT_TRUE(json != NULL, "legitimate entry_script 'scripts/main.grav' should pass validation");
    ASSERT_TRUE(result.error_count == 0, "legitimate entry_script should record zero errors");

    if (json) cJSON_Delete(json);
    free_validation_result(&result);
    remove(entry_path);
    rmdir(scripts_dir);
    remove(manifest_path);
    rmdir(tmp_dir);
}

/* --- size cap tests (SI-1) --- */

static void test_size_cap_helper(void) {
    ASSERT_FALSE(is_over_size_cap(0), "0 bytes is under the cap");
    ASSERT_FALSE(is_over_size_cap(PACKAGE_SIZE_CAP_BYTES), "exactly the cap is not over");
    ASSERT_TRUE(is_over_size_cap(PACKAGE_SIZE_CAP_BYTES + 1), "one byte over the cap is over");
    ASSERT_TRUE(is_over_size_cap((size_t)51 * 1024 * 1024), "51 MB is over the 50 MB cap");
    ASSERT_FALSE(is_over_size_cap((size_t)49 * 1024 * 1024), "49 MB is under the 50 MB cap");
}

int main(void) {
    test_asset_relative_traversal_rejected();
    test_asset_absolute_path_rejected();
    test_library_traversal_rejected();
    test_clean_asset_passes_traversal_check();
    test_entry_script_traversal_rejected();
    test_entry_script_legitimate_path_accepted();
    test_size_cap_helper();

    if (g_failures > 0) {
        fprintf(stderr, "\n%d assertion(s) failed\n", g_failures);
        return 1;
    }
    printf("All therd_package tests passed\n");
    return 0;
}
