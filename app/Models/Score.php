<?php

namespace App\Models;

use Database\Factories\ScoreFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One finished game, recorded for the world leaderboard.
 */
#[Fillable(['score', 'level', 'run', 'day'])]
class Score extends Model
{
    /** @use HasFactory<ScoreFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Today's date for the daily run. Runs change over at midnight in
     * Singapore, where the market is.
     */
    public static function today(): string
    {
        return now('Asia/Singapore')->toDateString();
    }

    /**
     * Position of this score on its board: 1 + the number of higher scores
     * on the same run (and, for the daily run, the same day).
     */
    public function rank(): int
    {
        return static::where('run', $this->run)
            ->when($this->day !== null, fn ($query) => $query->whereDate('day', $this->day))
            ->where('score', '>', $this->score)
            ->count() + 1;
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'score' => 'integer',
            'level' => 'integer',
            'day' => 'date:Y-m-d',
        ];
    }
}
