<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
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

    'gemini_ai' => [
        'project_id' => env('GEMINI_API_KEY'),
    ],

    'senopati' => [
        'api_url' => env('SENOPATI_API_URL'),
        'chat_model' => env('SENOPATI_CHAT_MODEL'),
    ],

    'chroma' => [
        'api_key' => env('CHROMA_API_KEY'),
        'tenant' => env('CHROMA_TENANT'),
        'database' => env('CHROMA_DATABASE'),
    ],

    'local_rag' => [
        'api_url' => env('RAG_API_URL'),
    ],
];
