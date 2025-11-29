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

    'rag_engine' => [
        'project_id' => env('RAG_ENGINE_PROJECT_ID'),
        'location' => env('RAG_ENGINE_LOCATION', 'us-east4'),
        'corpus_id' => env('RAG_ENGINE_CORPUS_ID'), // Use corpus_id instead of corpus_name
        'corpus_name' => env('RAG_ENGINE_CORPUS_NAME'), // Keep for display purposes
        'model' => env('RAG_ENGINE_MODEL', 'gemini-2.0-flash-001'),
        'credentials' => env('GOOGLE_CLOUD_KEY_FILE'),
    ],

    'senopati' => [
        'api_url' => env('SENOPATI_API_URL'),
        'model' => env('SENOPATI_MODEL'),
    ],
];
