<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Finished games submitted by signed-in players.
     */
    public function up(): void
    {
        Schema::create('scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('score');
            $table->unsignedSmallInteger('level');
            $table->timestamps();

            $table->index('score');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scores');
    }
};
