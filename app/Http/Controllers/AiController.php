<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class AiController extends Controller
{
    protected $senopatiApiUrl;
    protected $senopatiModel;

    public function __construct()
    {
        $this->senopatiApiUrl = config('services.senopati.api_url');
        $this->senopatiModel = config('services.senopati.model');
    }

    public function chat(Request $request)
    {
        set_time_limit(120); 

        $request->validate([
            'message' => 'required|string',
        ]);

        try {
            $response = Http::withoutVerifying() 
                ->timeout(60) 
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'accept' => 'application/json',
                ])->post($this->senopatiApiUrl, [
                    'model' => $this->senopatiModel,
                    'messages' => [
                        [
                            'role' => 'user',
                            'content' => $request->input('message'),
                        ],
                    ],
                    'temperature' => 0.7,
                    'stream' => false,
                ]);

            if ($response->successful()) {
                $data = $response->json();
                
                $content = $data['message']['content'] ?? 'No response content';

                return response()->json([
                    'success' => true,
                    'generated_response' => $content, 
                    'raw_data' => $data
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Gagal request ke AI: ' . $response->status(),
                    'error' => $response->body()
                ], 500);
            }

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan server',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}