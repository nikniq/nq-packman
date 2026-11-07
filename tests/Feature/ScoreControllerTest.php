<?php

namespace Tests\Feature;

use App\Models\Score;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class ScoreControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_the_leaderboard_lists_the_top_ten_by_score_without_exposing_emails(): void
    {
        Score::factory()->count(12)->sequence(fn ($sequence) => ['score' => ($sequence->index + 1) * 100])->create();

        $response = $this->getJson(route('scores.index'));

        $response->assertOk();
        $response->assertJsonCount(10, 'data');
        $response->assertJsonPath('data.0.score', 1200);
        $response->assertJsonPath('data.9.score', 300);
        $response->assertJsonStructure(['data' => [['name', 'score', 'level']]]);
        $this->assertStringNotContainsString('@', $response->getContent());
    }

    public function test_a_signed_in_player_can_save_a_score_and_learns_their_rank(): void
    {
        Score::factory()->create(['score' => 5000]);
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson(route('scores.store'), ['score' => 2500, 'level' => 3]);

        $response->assertCreated();
        $response->assertJson(['rank' => 2, 'best' => 2500]);
        $this->assertDatabaseHas('scores', ['user_id' => $user->id, 'score' => 2500, 'level' => 3]);
    }

    public function test_the_daily_board_only_lists_today_and_classic_scores_stay_off_it(): void
    {
        Score::factory()->create(['score' => 9000]);
        Score::factory()->daily('2000-01-01')->create(['score' => 8000]);
        Score::factory()->daily()->create(['score' => 700]);

        $response = $this->getJson(route('scores.index', ['board' => 'daily']));

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.score', 700);
        $response->assertJsonPath('board', 'daily');
        $response->assertJsonPath('day', Score::today());

        $this->getJson(route('scores.index'))->assertJsonCount(1, 'data')->assertJsonPath('data.0.score', 9000);
    }

    public function test_a_daily_score_is_ranked_against_today_and_only_one_attempt_is_accepted(): void
    {
        Score::factory()->daily()->create(['score' => 5000]);
        Score::factory()->create(['score' => 99999]);
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson(route('scores.store'), ['score' => 2500, 'level' => 2, 'run' => 'daily']);

        $response->assertCreated();
        $response->assertJson(['rank' => 2, 'best' => 2500]);
        $this->assertDatabaseHas('scores', ['user_id' => $user->id, 'run' => 'daily', 'day' => Score::today()]);

        $this->actingAs($user)->postJson(route('scores.store'), ['score' => 9000, 'level' => 5, 'run' => 'daily'])->assertStatus(409);
        $this->assertSame(1, $user->scores()->count());

        $this->actingAs($user)->postJson(route('scores.store'), ['score' => 10, 'level' => 1, 'run' => 'marathon'])->assertJsonValidationErrors('run');
    }

    public function test_guests_cannot_save_scores(): void
    {
        $this->postJson(route('scores.store'), ['score' => 100, 'level' => 1])->assertUnauthorized();
        $this->assertDatabaseCount('scores', 0);
    }

    public function test_scores_are_validated(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson(route('scores.store'), ['score' => 0, 'level' => 1])->assertJsonValidationErrors('score');
        $this->actingAs($user)->postJson(route('scores.store'), ['score' => 10000001, 'level' => 1])->assertJsonValidationErrors('score');
        $this->actingAs($user)->postJson(route('scores.store'), ['score' => 100, 'level' => 0])->assertJsonValidationErrors('level');
        $this->actingAs($user)->postJson(route('scores.store'), ['score' => 'lots', 'level' => 1])->assertJsonValidationErrors('score');
        $this->assertDatabaseCount('scores', 0);
    }

    public function test_score_submissions_are_rate_limited_per_player(): void
    {
        RateLimiter::clear('user:1');
        $user = User::factory()->create();

        foreach (range(1, 6) as $attempt) {
            $this->actingAs($user)->postJson(route('scores.store'), ['score' => $attempt, 'level' => 1])->assertCreated();
        }

        $this->actingAs($user)->postJson(route('scores.store'), ['score' => 7, 'level' => 1])->assertTooManyRequests();
    }
}
