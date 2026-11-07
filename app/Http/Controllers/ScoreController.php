<?php

namespace App\Http\Controllers;

use App\Http\Resources\ScoreResource;
use App\Models\Score;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * The leaderboards. Anyone can read them; only signed-in players add to them.
 *
 * Two boards: the all-time world board for classic runs, and today's board
 * for the daily run, where each player gets one attempt on that day's course.
 */
class ScoreController extends Controller
{
    public const BOARD_SIZE = 10;

    public function index(Request $request): AnonymousResourceCollection
    {
        $board = $request->query('board') === 'daily' ? 'daily' : 'classic';

        $query = Score::with('user')->where('run', $board);
        if ($board === 'daily') {
            $query->whereDate('day', Score::today());
        }

        return ScoreResource::collection(
            $query->orderByDesc('score')->oldest()->limit(self::BOARD_SIZE)->get()
        )->additional(['board' => $board, 'day' => Score::today()]);
    }

    /**
     * Scores come from the browser, so values are bounded to what a real game
     * can produce; the route is also rate limited. A daily score is refused
     * once the player has already recorded one for today.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'score' => ['required', 'integer', 'min:1', 'max:10000000'],
            'level' => ['required', 'integer', 'min:1', 'max:999'],
            'run' => ['sometimes', Rule::in(['classic', 'daily'])],
        ]);
        $run = $validated['run'] ?? 'classic';
        $day = $run === 'daily' ? Score::today() : null;

        if ($day !== null && $request->user()->scores()->whereDate('day', $day)->exists()) {
            return response()->json(['message' => 'You have already played today\'s run.'], 409);
        }

        $score = $request->user()->scores()->create([
            'score' => $validated['score'],
            'level' => $validated['level'],
            'run' => $run,
            'day' => $day,
        ]);

        return response()->json([
            'rank' => $score->rank(),
            'best' => (int) $request->user()->scores()->where('run', $run)->max('score'),
        ], 201);
    }
}
