cmake_minimum_required(VERSION 3.10)
project(therd-package VERSION 0.1.0 LANGUAGES C)

set(CMAKE_C_STANDARD 99)

set(GRAVITY_SRC "${CMAKE_CURRENT_SOURCE_DIR}/../../THerD/third_party/gravity/src")

set(GRAVITY_SOURCES
    # Compiler
    ${GRAVITY_SRC}/compiler/gravity_compiler.c
    ${GRAVITY_SRC}/compiler/gravity_lexer.c
    ${GRAVITY_SRC}/compiler/gravity_parser.c
    ${GRAVITY_SRC}/compiler/gravity_codegen.c
    ${GRAVITY_SRC}/compiler/gravity_optimizer.c
    ${GRAVITY_SRC}/compiler/gravity_symboltable.c
    ${GRAVITY_SRC}/compiler/gravity_ast.c
    ${GRAVITY_SRC}/compiler/gravity_ircode.c
    ${GRAVITY_SRC}/compiler/gravity_semacheck1.c
    ${GRAVITY_SRC}/compiler/gravity_semacheck2.c
    ${GRAVITY_SRC}/compiler/gravity_token.c
    ${GRAVITY_SRC}/compiler/gravity_visitor.c
    # Runtime
    ${GRAVITY_SRC}/runtime/gravity_vm.c
    ${GRAVITY_SRC}/runtime/gravity_core.c
    # Shared
    ${GRAVITY_SRC}/shared/gravity_value.c
    ${GRAVITY_SRC}/shared/gravity_hash.c
    ${GRAVITY_SRC}/shared/gravity_memory.c
    # Optionals
    ${GRAVITY_SRC}/optionals/gravity_opt_math.c
    ${GRAVITY_SRC}/optionals/gravity_opt_env.c
    ${GRAVITY_SRC}/optionals/gravity_opt_file.c
    ${GRAVITY_SRC}/optionals/gravity_opt_json.c
    # Utils
    ${GRAVITY_SRC}/utils/gravity_utils.c
    ${GRAVITY_SRC}/utils/gravity_debug.c
    ${GRAVITY_SRC}/utils/gravity_json.c
)

add_executable(therd-package
    therd_package.c
    cjson/cJSON.c
    miniz.c
    ${GRAVITY_SOURCES}
)

target_include_directories(therd-package PRIVATE
    cjson
    ${GRAVITY_SRC}/compiler
    ${GRAVITY_SRC}/runtime
    ${GRAVITY_SRC}/shared
    ${GRAVITY_SRC}/utils
    ${GRAVITY_SRC}/optionals
)

# Gravity needs -lm on POSIX; shlwapi on Windows (PathCombine* used by gravity_utils.c).
# MinGW does not auto-link via #pragma comment like MSVC, so we add it explicitly.
target_link_libraries(therd-package m)
if(WIN32)
    target_link_libraries(therd-package shlwapi)
endif()

install(TARGETS therd-package DESTINATION bin)

# --- Tier 1 unit tests (Phase 27.9-03 / SI-1) ---
# therd_package.c's functions are all `static` with no separate header, so
# the test source #includes therd_package.c directly (guarded by
# THERD_PACKAGE_TEST_BUILD, which compiles out therd_package.c's own main())
# rather than needing a refactor into a library target. This test binary is
# built from the same sources/include paths/link libs as therd-package
# itself since therd_package.c still references gravity_compiler_* symbols.
add_executable(therd-package-unit-tests
    ${CMAKE_CURRENT_SOURCE_DIR}/../tests/unit/test_therd_package.c
    cjson/cJSON.c
    miniz.c
    ${GRAVITY_SOURCES}
)

target_include_directories(therd-package-unit-tests PRIVATE
    cjson
    ${GRAVITY_SRC}/compiler
    ${GRAVITY_SRC}/runtime
    ${GRAVITY_SRC}/shared
    ${GRAVITY_SRC}/utils
    ${GRAVITY_SRC}/optionals
)

# THERD_PACKAGE_TEST_BUILD is defined by test_therd_package.c itself (before
# its #include of therd_package.c), not here, to avoid a duplicate-definition
# warning when both this file and the compiler command line define it.

target_link_libraries(therd-package-unit-tests m)
if(WIN32)
    target_link_libraries(therd-package-unit-tests shlwapi)
endif()

enable_testing()
add_test(NAME therd-package-unit-tests COMMAND therd-package-unit-tests)
