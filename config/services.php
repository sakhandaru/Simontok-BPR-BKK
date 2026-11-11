<?php

return [

    'sso' => [
        'enabled' => (bool) env('SIMONTOK_API_ENABLED', false),
        'local_bypass' => (bool) env('SSO_LOCAL_BYPASS', false),
        'local_password' => env('SSO_LOCAL_PASSWORD'),
        'url' => env('SIMONTOK_API_URL'),
        'app' => env('SIMONTOK_API_APP'),
        'app_token' => env('SIMONTOK_API_APP_TOKEN'),
        'timeout' => env('SIMONTOK_API_TIMEOUT', 10),
        'verify_ssl' => (bool) filter_var(env('SIMONTOK_API_VERIFY_SSL', true), FILTER_VALIDATE_BOOL),
        'emergency_login' => env('SSO_EMERGENCY_LOGIN'),
        'emergency_alert_email' => env('SSO_EMERGENCY_ALERT_EMAIL'),
    ],

    'simontok_api' => [
        'url' => env('SIMONTOK_API_URL'),
        'app' => env('SIMONTOK_API_APP'),
        'app_token' => env('SIMONTOK_API_APP_TOKEN'),
        'timeout' => (int) env('SIMONTOK_API_TIMEOUT', 10),
        'verify_ssl' => (bool) filter_var(env('SIMONTOK_API_VERIFY_SSL', true), FILTER_VALIDATE_BOOL),
        'token_session_key' => 'simontok_api.jwt',
    ],

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
