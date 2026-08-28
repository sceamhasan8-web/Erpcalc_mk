"use client";

import React from 'react';

interface PageSkeletonProps {
  type?: 'dashboard' | 'table' | 'cards' | 'details';
}

export function PageSkeleton({ type = 'table' }: PageSkeletonProps) {
  if (type === 'dashboard') {
    return (
      <div className="w-full space-y-6 animate-fade-in">
        {/* Header Skeleton */}
        <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl skeleton-shimmer flex-shrink-0" />
            <div className="space-y-2">
              <div className="h-5 w-48 rounded-lg skeleton-shimmer" />
              <div className="h-3.5 w-64 rounded-md skeleton-shimmer opacity-70" />
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-28 rounded-xl skeleton-shimmer" />
            <div className="h-9 w-32 rounded-xl skeleton-shimmer" />
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] space-y-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-20 rounded skeleton-shimmer opacity-75" />
                <div className="h-8 w-8 rounded-xl skeleton-shimmer" />
              </div>
              <div className="h-7 w-32 rounded-lg skeleton-shimmer" />
              <div className="h-3 w-40 rounded skeleton-shimmer opacity-60" />
            </div>
          ))}
        </div>

        {/* 2 Column Charts / Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--ec-border)]">
              <div className="h-4 w-44 rounded-lg skeleton-shimmer" />
              <div className="h-7 w-24 rounded-lg skeleton-shimmer" />
            </div>
            <div className="h-64 rounded-xl skeleton-shimmer opacity-80" />
          </div>

          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--ec-border)]">
              <div className="h-4 w-32 rounded-lg skeleton-shimmer" />
              <div className="h-4 w-12 rounded-lg skeleton-shimmer opacity-60" />
            </div>
            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)]/50">
                  <div className="h-4 w-28 rounded skeleton-shimmer" />
                  <div className="h-4 w-12 rounded-md skeleton-shimmer" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--ec-border)]">
            <div className="h-4 w-40 rounded-lg skeleton-shimmer" />
            <div className="h-4 w-24 rounded-lg skeleton-shimmer opacity-60" />
          </div>
          <div className="space-y-2.5 pt-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)]/50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-9 w-9 rounded-xl skeleton-shimmer flex-shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-40 rounded skeleton-shimmer" />
                    <div className="h-3 w-28 rounded skeleton-shimmer opacity-60" />
                  </div>
                </div>
                <div className="h-6 w-20 rounded-md skeleton-shimmer hidden sm:block" />
                <div className="h-6 w-24 rounded-xl skeleton-shimmer hidden md:block" />
                <div className="h-7 w-16 rounded-lg skeleton-shimmer flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === 'cards') {
    return (
      <div className="w-full space-y-5 animate-fade-in">
        {/* Header Skeleton */}
        <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl skeleton-shimmer flex-shrink-0" />
            <div className="space-y-1.5">
              <div className="h-5 w-44 rounded-lg skeleton-shimmer" />
              <div className="h-3.5 w-60 rounded-md skeleton-shimmer opacity-70" />
            </div>
          </div>
          <div className="h-9 w-32 rounded-xl skeleton-shimmer" />
        </div>

        {/* Filter Bar */}
        <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3.5 flex items-center justify-between gap-3">
          <div className="h-9 w-full max-w-sm rounded-xl skeleton-shimmer" />
          <div className="h-9 w-28 rounded-xl skeleton-shimmer" />
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-5 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl skeleton-shimmer" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-28 rounded skeleton-shimmer" />
                    <div className="h-3 w-20 rounded skeleton-shimmer opacity-60" />
                  </div>
                </div>
                <div className="h-6 w-16 rounded-full skeleton-shimmer" />
              </div>
              <div className="h-px w-full bg-[var(--ec-border)]" />
              <div className="space-y-2">
                <div className="h-3.5 w-full rounded skeleton-shimmer opacity-75" />
                <div className="h-3.5 w-3/4 rounded skeleton-shimmer opacity-60" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default 'table' variant
  return (
    <div className="w-full space-y-5 animate-fade-in">
      {/* Top Header Skeleton */}
      <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 sm:p-5 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl skeleton-shimmer flex-shrink-0" />
            <div className="space-y-1.5 min-w-0">
              <div className="h-5 w-44 sm:w-60 rounded-lg skeleton-shimmer" />
              <div className="h-3.5 w-60 sm:w-80 rounded-md skeleton-shimmer opacity-70" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-9 w-24 rounded-xl skeleton-shimmer" />
            <div className="h-9 w-28 rounded-xl skeleton-shimmer" />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] space-y-2.5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded skeleton-shimmer opacity-75" />
              <div className="h-7 w-7 rounded-lg skeleton-shimmer" />
            </div>
            <div className="h-6 w-28 rounded-lg skeleton-shimmer" />
            <div className="h-3 w-36 rounded skeleton-shimmer opacity-60" />
          </div>
        ))}
      </div>

      {/* Filter / Search Bar Skeleton */}
      <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="h-9 w-full max-w-sm rounded-xl skeleton-shimmer" />
          <div className="h-9 w-24 rounded-xl skeleton-shimmer hidden sm:block" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 rounded-xl skeleton-shimmer" />
          <div className="h-9 w-24 rounded-xl skeleton-shimmer" />
        </div>
      </div>

      {/* Main Content Area Skeleton: Table Rows */}
      <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 sm:p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--ec-border)] pb-3">
          <div className="h-4 w-44 rounded-md skeleton-shimmer" />
          <div className="h-4 w-20 rounded-md skeleton-shimmer opacity-60" />
        </div>

        {/* Shimmer Rows */}
        <div className="space-y-2.5 pt-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)]/60 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="h-8 w-8 rounded-lg skeleton-shimmer flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-32 sm:w-48 rounded skeleton-shimmer" />
                  <div className="h-3 w-24 sm:w-36 rounded skeleton-shimmer opacity-60" />
                </div>
              </div>

              <div className="h-6 w-20 rounded-md skeleton-shimmer hidden sm:block" />
              <div className="h-6 w-24 rounded-xl skeleton-shimmer hidden md:block" />
              <div className="h-7 w-16 rounded-lg skeleton-shimmer flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PageSkeleton;
