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

# Gravity needs -lm
target_link_libraries(therd-package m)

install(TARGETS therd-package DESTINATION bin)
