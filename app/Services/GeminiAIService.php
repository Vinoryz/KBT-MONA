<?php

namespace App\Services;

use GuzzleHttp\Client;
use Exception;
use Illuminate\Http\UploadedFile;

class GeminiAIService
{
    protected $apiKey;
    protected $apiUrl;
    protected $httpClient;

    public function __construct()
    {
        $this->apiKey = config('services.gemini_ai.project_id');
        $this->apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . $this->apiKey;
        $this->httpClient = new Client();
    }


    public function extractReceiptData(UploadedFile $imageFile) {

        $prompt = <<<PROMPT
Analisis gambar struk ini. Ekstrak informasi berikut dan berikan HANYA dalam format JSON:
1. "type": Tentukan apakah ini "expense" (pengeluaran) atau "income" (pemasukan).
2. "amount": Angka total akhir transaksi tanpa titik atau koma. Jika ada diskon atau pajak, gunakan jumlah setelah kalkulasi.
3. "date": Tanggal transaksi dalam format YYYY-MM-DD, tanggal transaksi pasti tidak lebih dari 90 hari yang lalu, pastikan data yang diberikan akurat.
4. "description": Deskripsi singkat dan jelas dari transaksi, biasanya nama toko atau item utama.
5. "category": Jika expense kategorikan transaksi ke dalam salah satu dari berikut: 'Food and Beverages', 'Shopping', 'Entertainment', 'Bills and Utilities', 'Other Expense'. Jika income kategorikan transaksi ke dalam salah satu dari berikut: 'Salary', 'Bonus', 'Business Income', 'Gift', 'Other Income'.
6. "items": Array dari item-item dalam struk (jika ada dan terbaca). Setiap item harus memiliki:
   - "item_name": Nama item/barang
   - "quantity": Jumlah/kuantitas item (default 1 jika tidak ada)
   - "item_price": Harga per item (bukan total, tapi harga satuan)
   
   Jika struk tidak memiliki detail item atau tidak terbaca dengan jelas, berikan array kosong [].

Contoh output JSON yang diinginkan (dengan items):
{
    "type": "expense",
    "amount": 115500,
    "date": "2024-05-21",
    "description": "Pembelian di Indomaret",
    "category": "Food and Beverages",
    "items": [
        {"item_name": "Indomie Goreng", "quantity": 5, "item_price": 3500},
        {"item_name": "Teh Botol", "quantity": 2, "item_price": 5000},
        {"item_name": "Roti Tawar", "quantity": 1, "item_price": 15000}
    ]
}

Contoh output JSON tanpa items (jika tidak terbaca):
{
    "type": "expense",
    "amount": 50000,
    "date": "2024-05-21",
    "description": "Pembelian di Alfamart",
    "category": "Shopping",
    "items": []
}

PENTING: 
- Pastikan total amount sesuai dengan jumlah akhir di struk (setelah diskon/pajak).
- item_price adalah harga PER ITEM, bukan total. Total = quantity × item_price.
- Jika ada item dengan qty > 1, pastikan item_price adalah harga satuan.
- Jika struk tidak jelas atau tidak ada detail item, gunakan items: []

Jika ada informasi yang tidak ditemukan, berikan nilai null untuk field tersebut (kecuali items yang harus array). Berikan HANYA JSON, tanpa teks tambahan.
PROMPT;

        $mimeType = $imageFile->getMimeType();
        $imageBase64 = base64_encode(file_get_contents($imageFile->getRealPath()));

        $data = [
            'contents' => [
                [
                    'parts' => [
                        ['text' => $prompt],
                        ['inline_data' => ['mime_type' => $mimeType, 'data' => $imageBase64]]
                    ]
                ]
            ],
             "generationConfig" => [
                "response_mime_type" => "application/json",
            ]
        ];

        try {
            $response = $this->httpClient->post($this->apiUrl, [
                'json' => $data,
                'headers' => ['Content-Type' => 'application/json']
            ]);

            $result = json_decode($response->getBody(), true);

            if (isset($result['candidates'][0]['content']['parts'][0]['text'])) {
                $jsonText = $result['candidates'][0]['content']['parts'][0]['text'];
                return json_decode($jsonText, true);
            }
            
            throw new Exception('Struktur respons dari Gemini tidak valid.');

        } catch (Exception $e) {
            throw new Exception('Gagal berkomunikasi dengan Gemini API: ' . $e->getMessage());
        }
    }

    /**
     * Menghasilkan respon teks umum menggunakan Gemini API.
     *
     * @param string $prompt
     * @return string
     * @throws Exception
     */
    public function generateChatResponse(string $prompt): string
    {
        $data = [
            'contents' => [
                [
                    'parts' => [
                        ['text' => $prompt]
                    ]
                ]
            ]
        ];

        try {
            $response = $this->httpClient->post($this->apiUrl, [
                'json' => $data,
                'headers' => ['Content-Type' => 'application/json']
            ]);

            $result = json_decode($response->getBody(), true);

            if (isset($result['candidates'][0]['content']['parts'][0]['text'])) {
                return $result['candidates'][0]['content']['parts'][0]['text'];
            }

            throw new Exception('Struktur respons dari Gemini tidak valid.');

        } catch (Exception $e) {
            throw new Exception('Gagal berkomunikasi dengan Gemini API: ' . $e->getMessage());
        }
    }
}