<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class ChatBotController extends Controller
{
    protected $senopatiApiUrl;
    protected $senopatiModel;
    protected $localRagApiUrl;

    public function __construct()
    {
        $this->senopatiApiUrl = config('services.senopati.api_url');
        $this->senopatiModel = config('services.senopati.chat_model');
        $this->localRagApiUrl = config('services.local_rag.api_url');
    }

    public function chat(Request $request)
    {
        $this->senopatiApiUrl = $this->senopatiApiUrl . '/chat';

        set_time_limit(120); 

        $request->validate([
            'message' => 'required|string',
        ]);

        $user_question = $request->input('message');
        $full_prompt = '';
        
        // QUERY DARI RAG LOCAL SERVICE

        try {
            $response = Http::withoutVerifying()
                ->timeout(60)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ])->post($this->localRagApiUrl, [
                    'question' => $user_question,
                    'n_results' => 3
                ]);

            if ($response->successful()) {
                $data = $response->json();
                
                $full_prompt = $data['content'] ?? 'No response content';
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Gagal request ke server RAG: ' . $response->status(),
                    'error' => $response->body()
                ], 500);
            }

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan server RAG',
                'error' => $e->getMessage()
            ], 500);
        }

        // KIRIM PROMPT KE SENOPATI DENGAN KONTEKS DARI RAG

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
                            'content' => $full_prompt,
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
                    'content' => $content
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Gagal request ke Senopati: ' . $response->status(),
                    'error' => $response->body()
                ], 500);
            }

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan server Senopati',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}