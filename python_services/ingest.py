import os
import sys

# Tambahkan direktori saat ini ke path agar bisa import dari chroma_connection
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from chroma_connection import get_chroma_client, get_chroma_collection

def seed_database():
    print("Menghubungkan ke database Chroma lokal...")
    client = get_chroma_client()
    collection = get_chroma_collection(client)

    
    # Data dummy pengetahuan finansial untuk RAG
    financial_data = [
        {
            "id": "tip_1",
            "text": "Untuk mengurangi pengeluaran bulanan, Anda dapat menggunakan aturan 50/30/20. Alokasikan 50% pendapatan untuk kebutuhan pokok (makanan, tagihan, sewa), 30% untuk keinginan (hiburan, hobi), dan 20% untuk tabungan atau membayar hutang."
        },
        {
            "id": "tip_2",
            "text": "Cara efektif memotong anggaran hiburan adalah dengan menetapkan batas pengeluaran mingguan secara tunai atau di rekening terpisah. Jika dana habis, Anda harus menunggu hingga minggu berikutnya."
        },
        {
            "id": "tip_3",
            "text": "Investasi sebaiknya dimulai setelah Anda memiliki dana darurat yang cukup (setara 3-6 bulan pengeluaran). Dahulukan melunasi hutang dengan bunga tinggi sebelum mulai berinvestasi."
        },
        {
            "id": "tip_4",
            "text": "Aturan 24 jam untuk pembelian besar: Sebelum membeli barang non-pokok yang mahal, tunggulah selama 24 jam. Hal ini membantu menghindari pembelian impulsif secara emosional."
        },
        {
            "id": "tip_5",
            "text": "Gunakan fitur autodebet untuk tabungan sesaat setelah menerima gaji. Cara ini memastikan Anda menabung terlebih dahulu sebelum mulai membelanjakan sisa uang Anda."
        }
    ]
    
    ids = [item["id"] for item in financial_data]
    documents = [item["text"] for item in financial_data]
    
    print(f"Memasukkan {len(documents)} dokumen pengetahuan keuangan ke Chroma DB...")
    
    try:
        collection.add(
            ids=ids,
            documents=documents
        )
        print("✅ Data berhasil dimasukkan ke database vektor lokal!")
        print("Sekarang Anda bisa mencoba bertanya ke Chatbot tentang pengeluaran, dana darurat, investasi, atau tips menabung.")
    except Exception as e:
        print(f"❌ Gagal memasukkan data: {e}")

if __name__ == "__main__":
    seed_database()
