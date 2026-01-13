#!/usr/bin/env python3
"""
FirstTry ROI Calculator — Deterministic ROI Estimation Tool

This script calculates ROI for FirstTry deployments based on user inputs.
All calculations are examples only and depend on accurate input from your organization.

Usage:
    python3 roi_calc.py \
        --engineers 20 \
        --releases_per_year 24 \
        --issues_per_release 150 \
        --hours_saved_per_issue 0.025 \
        --loaded_hourly_cost 60 \
        --error_cost_per_violation 200 \
        --violations_per_release_before 8 \
        --violations_caught_percentage 85 \
        --hours_setup_config 12 \
        --hours_training 4 \
        --hours_maintenance_per_year 2

Output:
    ROI table with cost, benefit, and payback metrics

Important:
    - All numbers are EXAMPLES. Replace with YOUR organization's data.
    - ROI is highly sensitive to input assumptions.
    - Always validate with actual measurements (before/after).
"""

import argparse
import sys


def calculate_roi(
    engineers,
    releases_per_year,
    issues_per_release,
    hours_saved_per_issue,
    loaded_hourly_cost,
    error_cost_per_violation,
    violations_per_release_before,
    violations_caught_percentage,
    hours_setup_config,
    hours_training,
    hours_maintenance_per_year,
    years=5,
):
    """Calculate FirstTry ROI based on input parameters."""

    # Setup cost
    setup_hours = hours_setup_config + hours_training
    setup_cost = setup_hours * loaded_hourly_cost

    # Maintenance cost (annual, then multiply by years)
    annual_maintenance_cost = hours_maintenance_per_year * loaded_hourly_cost
    total_maintenance_cost = annual_maintenance_cost * years

    # Total cost
    total_cost = setup_cost + total_maintenance_cost

    # ===== BENEFITS =====

    # Time savings per release
    time_saved_per_release_hours = issues_per_release * hours_saved_per_issue
    time_saved_per_release_cost = time_saved_per_release_hours * loaded_hourly_cost

    # Annual time savings
    annual_time_savings_hours = time_saved_per_release_hours * releases_per_year
    annual_time_savings_cost = annual_time_savings_hours * loaded_hourly_cost

    # Error prevention per release
    violations_prevented_per_release = (
        violations_per_release_before * violations_caught_percentage / 100
    )
    error_prevention_per_release = (
        violations_prevented_per_release * error_cost_per_violation
    )

    # Annual error prevention
    annual_error_prevention_cost = (
        error_prevention_per_release * releases_per_year
    )

    # Total annual benefit
    total_annual_benefit = annual_time_savings_cost + annual_error_prevention_cost

    # Total benefit over years
    total_benefit = total_annual_benefit * years

    # ===== ROI METRICS =====

    # ROI percentage
    roi_percentage = ((total_benefit - total_cost) / total_cost * 100) if total_cost > 0 else 0

    # Payback period (months)
    payback_months = (total_cost / (total_annual_benefit / 12)) if total_annual_benefit > 0 else float('inf')

    # NPV (10% discount rate)
    discount_rate = 0.10
    npv = -setup_cost
    for year in range(1, years + 1):
        npv += total_annual_benefit / ((1 + discount_rate) ** year)

    return {
        "costs": {
            "setup_hours": setup_hours,
            "setup_cost": setup_cost,
            "annual_maintenance_cost": annual_maintenance_cost,
            "total_maintenance_cost": total_maintenance_cost,
            "total_cost": total_cost,
        },
        "benefits": {
            "time_saved_per_release_hours": time_saved_per_release_hours,
            "time_saved_per_release_cost": time_saved_per_release_cost,
            "annual_time_savings_hours": annual_time_savings_hours,
            "annual_time_savings_cost": annual_time_savings_cost,
            "violations_prevented_per_release": violations_prevented_per_release,
            "error_prevention_per_release": error_prevention_per_release,
            "annual_error_prevention_cost": annual_error_prevention_cost,
            "total_annual_benefit": total_annual_benefit,
            "total_benefit": total_benefit,
        },
        "metrics": {
            "roi_percentage": roi_percentage,
            "payback_months": payback_months,
            "npv": npv,
        },
    }


def format_currency(value):
    """Format value as USD currency."""
    return f"${value:,.2f}"


def format_hours(value):
    """Format value as hours with decimal."""
    return f"{value:.2f}h"


def format_percent(value):
    """Format value as percentage."""
    return f"{value:.1f}%"


def print_results(result, years=5):
    """Print ROI results in a readable format."""

    costs = result["costs"]
    benefits = result["benefits"]
    metrics = result["metrics"]

    print("\n" + "=" * 70)
    print("FIRSTTRY ROI CALCULATION")
    print("=" * 70)
    print(f"Timeframe: {years} years")
    print("⚠️  All numbers are EXAMPLES. Replace with YOUR organization's data.\n")

    # ===== COST SUMMARY =====
    print("\n--- COST SUMMARY ---")
    print(f"Setup & Configuration:   {format_hours(costs['setup_hours'])} × ${costs['setup_cost']/costs['setup_hours']:.2f}/h = {format_currency(costs['setup_cost'])}")
    print(f"Annual Maintenance:      {format_currency(costs['annual_maintenance_cost'])}")
    print(f"Total Maintenance ({years}y): {format_currency(costs['total_maintenance_cost'])}")
    print(f"{'─' * 50}")
    print(f"TOTAL COST ({years} years):   {format_currency(costs['total_cost'])}")

    # ===== BENEFIT SUMMARY =====
    print("\n--- BENEFIT SUMMARY (Annual) ---")
    print(f"Time Savings per Release: {format_hours(benefits['time_saved_per_release_hours'])} × {format_currency(benefits['time_saved_per_release_cost']/benefits['time_saved_per_release_hours'])} = {format_currency(benefits['time_saved_per_release_cost'])}")
    print(f"Annual Time Savings:      {format_currency(benefits['annual_time_savings_cost'])}")
    print(f"Annual Error Prevention:  {format_currency(benefits['annual_error_prevention_cost'])}")
    print(f"{'─' * 50}")
    print(f"TOTAL ANNUAL BENEFIT:     {format_currency(benefits['total_annual_benefit'])}")
    print(f"TOTAL BENEFIT ({years}y):    {format_currency(benefits['total_benefit'])}")

    # ===== ROI METRICS =====
    print("\n--- ROI METRICS ---")
    print(f"Return on Investment:     {format_percent(metrics['roi_percentage'])}")
    payback_text = (
        f"{metrics['payback_months']:.1f} months"
        if metrics['payback_months'] != float('inf') else
        "N/A (negative ROI)"
    )
    print(f"Payback Period:           {payback_text}")
    print(f"Net Present Value (10%):  {format_currency(metrics['npv'])}")

    print("\n" + "=" * 70)
    print("DISCLAIMER: These calculations are estimates based on your inputs.")
    print("Always validate assumptions with actual measurements.")
    print("=" * 70 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="FirstTry ROI Calculator",
        epilog="Example: python3 roi_calc.py --engineers 20 --releases_per_year 24 --issues_per_release 150 --hours_saved_per_issue 0.025 --loaded_hourly_cost 60 --error_cost_per_violation 200 --violations_per_release_before 8 --violations_caught_percentage 85 --hours_setup_config 12 --hours_training 4 --hours_maintenance_per_year 2",
    )

    # Organizational parameters
    parser.add_argument(
        "--engineers",
        type=int,
        default=20,
        help="Number of engineers using FirstTry",
    )
    parser.add_argument(
        "--releases_per_year",
        type=int,
        default=24,
        help="Number of releases per year",
    )
    parser.add_argument(
        "--issues_per_release",
        type=int,
        default=150,
        help="Number of issues per release",
    )

    # Time parameters
    parser.add_argument(
        "--hours_saved_per_issue",
        type=float,
        default=0.025,
        help="Hours saved per issue (e.g., 0.025 = 1.5 minutes)",
    )
    parser.add_argument(
        "--loaded_hourly_cost",
        type=float,
        default=60,
        help="Fully loaded hourly cost per engineer",
    )

    # Cost parameters
    parser.add_argument(
        "--error_cost_per_violation",
        type=float,
        default=200,
        help="Cost to fix one policy violation (rework, delay)",
    )

    # Benefit parameters
    parser.add_argument(
        "--violations_per_release_before",
        type=float,
        default=8,
        help="Average violations per release before FirstTry",
    )
    parser.add_argument(
        "--violations_caught_percentage",
        type=float,
        default=85,
        help="Percentage of violations FirstTry catches (0-100)",
    )

    # Setup parameters
    parser.add_argument(
        "--hours_setup_config",
        type=float,
        default=12,
        help="Hours to set up and configure FirstTry",
    )
    parser.add_argument(
        "--hours_training",
        type=float,
        default=4,
        help="Hours to train team on FirstTry",
    )
    parser.add_argument(
        "--hours_maintenance_per_year",
        type=float,
        default=2,
        help="Hours per year for maintenance and updates",
    )

    # Years
    parser.add_argument(
        "--years",
        type=int,
        default=5,
        help="Number of years to calculate ROI for",
    )

    args = parser.parse_args()

    # Validate inputs
    if args.violations_caught_percentage < 0 or args.violations_caught_percentage > 100:
        print("ERROR: violations_caught_percentage must be between 0 and 100", file=sys.stderr)
        sys.exit(1)

    if args.engineers <= 0 or args.releases_per_year <= 0 or args.issues_per_release <= 0:
        print("ERROR: engineers, releases_per_year, and issues_per_release must be > 0", file=sys.stderr)
        sys.exit(1)

    # Calculate ROI
    result = calculate_roi(
        engineers=args.engineers,
        releases_per_year=args.releases_per_year,
        issues_per_release=args.issues_per_release,
        hours_saved_per_issue=args.hours_saved_per_issue,
        loaded_hourly_cost=args.loaded_hourly_cost,
        error_cost_per_violation=args.error_cost_per_violation,
        violations_per_release_before=args.violations_per_release_before,
        violations_caught_percentage=args.violations_caught_percentage,
        hours_setup_config=args.hours_setup_config,
        hours_training=args.hours_training,
        hours_maintenance_per_year=args.hours_maintenance_per_year,
        years=args.years,
    )

    # Print results
    print_results(result, years=args.years)

    # Return exit code 0 for success
    return 0


if __name__ == "__main__":
    sys.exit(main())
