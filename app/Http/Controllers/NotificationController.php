<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\BudgetAlertService;
use App\Models\Transaction;
use App\Models\Budget;
use App\Models\Category;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    /**
     * Get all notifications for the current user
     * This includes budget alerts and missing budget warnings
     */
    public function index(Request $request)
    {
        try {
            $userId = $request->user()->id;
            $notifications = [];
            
            // Get budget alerts using the existing service
            $budgetAlertService = new BudgetAlertService();
            $budgetAlerts = $budgetAlertService->checkBudgetAlerts($userId);
            
            // Transform budget alerts to notification format
            foreach ($budgetAlerts as $alert) {
                $type = $alert['is_exceeded'] ? 'critical' : 
                       ($alert['percentage'] >= 95 ? 'warning' : 'info');
                
                $notifications[] = [
                    'id' => 'budget_alert_' . $alert['category_id'],
                    'type' => $type,
                    'category' => $alert['category_name'],
                    'message' => $alert['message'],
                    'timestamp' => now()->toISOString(),
                    'data' => [
                        'percentage' => $alert['percentage'],
                        'spent' => $alert['spent_amount'],
                        'budget' => $alert['budget_amount'],
                        'remaining' => $alert['remaining'],
                    ]
                ];
            }
            
            // Check for categories with transactions but no budget for current month
            $missingBudgets = $this->checkMissingBudgets($userId);
            
            foreach ($missingBudgets as $missing) {
                $notifications[] = [
                    'id' => 'missing_budget_' . $missing['category_id'],
                    'type' => 'info',
                    'category' => $missing['category_name'],
                    'message' => "You have transactions in {$missing['category_name']} but no budget set for this month.",
                    'timestamp' => now()->toISOString(),
                    'data' => [
                        'transaction_count' => $missing['transaction_count'],
                        'total_amount' => $missing['total_amount'],
                    ]
                ];
            }
            
            return response()->json([
                'status' => 'success',
                'data' => [
                    'notifications' => $notifications,
                    'unread_count' => count($notifications),
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to fetch notifications',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }
    
    /**
     * Check for categories that have transactions this month but no budget set
     */
    private function checkMissingBudgets($userId)
    {
        $now = Carbon::now();
        $startOfMonth = $now->copy()->startOfMonth();
        $endOfMonth = $now->copy()->endOfMonth();
        
        // Get all expense categories that have transactions this month
        $categoriesWithTransactions = DB::table('transactions as t')
            ->join('categories as c', 't.category_id', '=', 'c.id')
            ->where('t.user_id', $userId)
            ->where('c.type', 'expense') // Only check expense categories
            ->whereBetween('t.transaction_date', [$startOfMonth, $endOfMonth])
            ->select(
                'c.id as category_id',
                'c.category_name',
                DB::raw('COUNT(t.id) as transaction_count'),
                DB::raw('SUM(ABS(t.amount)) as total_amount')
            )
            ->groupBy('c.id', 'c.category_name')
            ->get();
        
        $missingBudgets = [];
        
        foreach ($categoriesWithTransactions as $category) {
            // Check if there's a budget for this category in the current month
            $hasBudget = Budget::where('user_id', $userId)
                ->where('category_id', $category->category_id)
                ->whereYear('start_date', $now->year)
                ->whereMonth('start_date', $now->month)
                ->exists();
            
            if (!$hasBudget) {
                $missingBudgets[] = [
                    'category_id' => $category->category_id,
                    'category_name' => $category->category_name,
                    'transaction_count' => $category->transaction_count,
                    'total_amount' => (float) $category->total_amount,
                ];
            }
        }
        
        return $missingBudgets;
    }
}
