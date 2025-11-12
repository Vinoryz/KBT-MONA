<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Carbon\Carbon;

class ProfileController extends Controller
{
    public function show(Request $request)
    {
        return Inertia::render('Profile/Show'); // komponenmu: Show.jsx
    }

    public function edit(Request $request)
    {
        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => false,
            'status' => session('status'),
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();

        // (Optional) Gabung first_name + last_name kalau frontend kirim terpisah
        if ($request->filled('first_name') || $request->filled('last_name')) {
            $first = trim($request->input('first_name', ''));
            $last  = trim($request->input('last_name', ''));
            if ($first !== '' || $last !== '') {
                $request->merge(['name' => trim(preg_replace('/\s+/', ' ', "{$first} {$last}"))]);
            }
        }

        // Normalisasi DOB dd/mm/yyyy → Y-m-d (biar aman ke DB)
        if ($request->filled('date_of_birth')) {
            $request->merge(['date_of_birth' => $this->normalizeDob($request->input('date_of_birth'))]);
        }

        $validated = $request->validate([
            'name'           => ['required','string','max:255'],
            'email'          => ['required','email','max:255', Rule::unique('users','email')->ignore($user->id)],
            'phone'          => ['nullable','string','max:30'],
            'date_of_birth'  => ['nullable','date'], // sudah dinormalisasi
            'profile_photo'  => ['nullable','image','mimes:jpg,jpeg,png','max:2048'],
        ]);

        // Handle upload foto (opsional)
        if ($request->hasFile('profile_photo')) {
            // hapus foto lama kalau ada
            if ($user->profile_photo_path) {
                Storage::disk('public')->delete($user->profile_photo_path);
            }
            $path = $request->file('profile_photo')->store('profile-photos', 'public');
            $validated['profile_photo_path'] = $path;
        }

        $user->update($validated);

        return back()->with('status','profile-updated');
    }

    public function removePhoto(Request $request)
    {
        $user = $request->user();
        if ($user->profile_photo_path) {
            Storage::disk('public')->delete($user->profile_photo_path);
            $user->update(['profile_photo_path' => null]);
        }
        return back();
    }

    private function normalizeDob(string $value): string
    {
        // dd/mm/yyyy
        try { return Carbon::createFromFormat('d/m/Y', $value)->format('Y-m-d'); } catch (\Throwable $e) {}
        // yyyy-mm-dd
        try { return Carbon::createFromFormat('Y-m-d', $value)->format('Y-m-d'); } catch (\Throwable $e) {}
        // fallback: biar validasi gagal dengan pesan yang jelas
        abort(422, 'Date of birth must be in the format dd/mm/yyyy.');
    }
}