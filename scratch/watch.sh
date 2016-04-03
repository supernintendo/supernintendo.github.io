#!/bin/bash

fswatch . 'git commit -avm "snapshot at ${date}" && git push'
