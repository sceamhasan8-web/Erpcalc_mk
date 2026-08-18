"use client";

import React from 'react';

interface PageSkeletonProps {
  type?: 'dashboard' | 'table' | 'cards';
}

export function PageSkeleton({ type = 'table' }: PageSkeletonProps) {
  return (
    <div className="w-full space-y-5 animate-fade-in">
      {/* Top Header & Breadcrumb Skeleton */}
      <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl skeleton-shimmer flex-shrink-0" />
            <div className="space-y-1.5 min-w-0">
              <div className="h-5 w-40 sm:w-56 rounded-lg skeleton-shimmer" />
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
            className="p-4 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] space-y-2.5"
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
      <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="h-9 w-full max-w-sm rounded-xl skeleton-shimmer" />
          <div className="h-9 w-24 rounded-xl skeleton-shimmer hidden sm:block" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 rounded-xl skeleton-shimmer" />
          <div className="h-9 w-24 rounded-xl skeleton-shimmer" />
        </div>
      </div>

      {/* Main Content Area Skeleton: Table Rows or Cards */}
      <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 sm:p-5 space-y-3">
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
