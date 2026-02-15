cmake_minimum_required(VERSION 3.10)
project(therd-package VERSION 0.1.0 LANGUAGES C)

set(CMAKE_C_STANDARD 99)

add_executable(therd-package
    therd_package.c
    cjson/cJSON.c
    miniz.c
)

target_include_directories(therd-package PRIVATE cjson)

# Add math library for miniz
target_link_libraries(therd-package m)

install(TARGETS therd-package DESTINATION bin)
