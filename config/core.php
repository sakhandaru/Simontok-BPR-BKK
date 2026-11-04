<?php

return [
    'provider' => env('CORE_PROVIDER', 'dummy'),
    'read_model' => env('CORE_READ_MODEL', 'direct'),
    'staging_ttl_minutes' => (int) env('CORE_STAGING_TTL_MINUTES', 60),
];
