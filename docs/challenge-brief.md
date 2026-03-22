# Technical Challenge: Build an AI-Powered Account Prioritisation Tool

This document contains the challenge brief only. The accompanying CSV file is the source dataset for the exercise.

## Context

A Tenzing portfolio company generates large volumes of operational data across leads, accounts, support activity, revenue signals, and customer notes. Leadership struggles to consistently answer which accounts need attention, where revenue may be at risk, where growth opportunities are emerging, and what action should be taken.

## Your Task

Build a prototype internal tool that produces a clear, defensible, and actionable prioritisation of accounts for leadership to focus on.

- The output must go beyond dashboards or summaries.
- The product should help leadership decide who to focus on, why, and what should happen next.

## Source Data

The dataset is provided as a single CSV file. It contains account-level records combining structured operational signals and recent text notes. Treat the CSV as the source data for the challenge.

- The source includes signals related to accounts, leads, support activity, revenue metrics, and customer notes.
- You may derive features, create views, or create supporting tables as needed for your prototype.
- The source data should remain the basis of your solution.

## Minimum Requirements

- Include authentication.
- Use the provided dataset.
- Integrate an AI API.
- Tackle the prioritisation of accounts directly.

## Example User Flow

1. Sign in.
2. View a portfolio overview.
3. See prioritised accounts.
4. Drill into an account.
5. View reasoning and supporting evidence.
6. See recommended next actions.
7. Save or record decisions.

## Evaluation Criteria

- Clarity and defensibility of prioritisation logic.
- Quality of AI integration and whether it improves decisions.
- Architecture decisions.
- Handling of imperfect operational data.
- Quality of reasoning explanations.
- UX clarity for leadership use.
- Trade-offs and overall system thinking.

## Not Being Evaluated

- Pixel-perfect design.
- Extensive data cleaning.
- Production-hardening beyond reasonable scope.

## Submission Requirements

- Link to a working prototype.
- Repository, if applicable.
- A short write-up covering architecture decisions, how prioritisation works, how AI improves the workflow, trade-offs, and what you would build next.

## Dataset Notes

The CSV includes 60 synthetic account records. Columns include commercial context, ownership, support activity, revenue and usage trend fields, and recent free-text notes. Nulls and mixed-signal accounts are present.

## Deliverables

| Included File | Purpose |
|---------------|---------|
| `account_prioritisation_challenge_data.csv` | Source dataset for the challenge |
| `account_prioritisation_challenge_instructions.pdf` | Challenge brief and submission instructions |

No implementation guide, scoring model, or solution approach is included in this document.
