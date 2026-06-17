<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use App\Services\GeminiAIService;

class ChatBotController extends Controller
{
    protected $localRagApiUrl;
    protected $geminiAI;

    public function __construct(GeminiAIService $geminiAI)
    {
        $this->localRagApiUrl = config('services.local_rag.api_url');
        $this->geminiAI = $geminiAI;
    }

    public function chat(Request $request)
    {
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

        // KIRIM PROMPT KE GEMINI DENGAN KONTEKS DARI RAG

        try {
            $content = $this->geminiAI->generateChatResponse($full_prompt);

            return response()->json([
                'success' => true,
                'content' => $content
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan server Gemini AI',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}