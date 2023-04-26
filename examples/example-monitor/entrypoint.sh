#!/bin/sh

if [ "$RUN_MODE" = "debug-wait-for-connection" ]; then
    echo 'Starting in debug mode. Will wait for debugger connection.'
    yarn run start:debug-brk
elif [ "$RUN_MODE"  = "debug" ]; then
    echo 'Starting in debug mode. Will NOT wait for debugger connection.'
    yarn run start:debug
elif [ "$RUN_MODE"  = "no-process" ]; then
    echo 'Starting container without launching of the application.'
    trap : TERM INT; sleep 9999999999d & wait
else
    echo "Starting."
    yarn run start
fi
