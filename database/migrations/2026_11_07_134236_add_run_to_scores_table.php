<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A score belongs to a run: 'classic' (the shared mazes, always open) or
     * 'daily' (one attempt per player per day on that day's course).
     */
    public function up(): void
    {
        Schema::table('scores', function (Blueprint $table) {
            $table->string('run', 16)->default('classic')->after('level');
            $table->date('day')->nullable()->after('run');
            $table->unique(['user_id', 'day']);
            $table->index(['run', 'day', 'score']);
        });
    }

    public function down(): void
    {
        Schema::table('scores', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'day']);
            $table->dropIndex(['run', 'day', 'score']);
            $table->dropColumn(['run', 'day']);
        });
    }
};
