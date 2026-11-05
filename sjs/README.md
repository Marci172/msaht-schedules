# schweminOPT Job Shop Scaling set (SJS), version 1 (2026)

190 job shop instances for measuring how solvers behave across instance sizes and shapes. The classic sets jump from
small instances (Taillard: up to 100 x 20) to 100 x 100 and 1000 x 1000 (Da Col & Teppan 2022) with little in between;
SJS fills the range below and above 100 x 100, varies the ratio of jobs to machines at equal size, and the number of
machines at a fixed number of jobs.

## Instances

Ten instances per size, named `sjs_J_M_k` (J jobs, M machines, instance k = 1..10). Processing times are uniform in
1..99 as in Taillard's set; the `sjsw_J_M_k` instances use 1..1000 as Da Col & Teppan's.

| Group | Sizes (J x M) | Operations | Instances |
|---|---|---|---|
| Squares below 100 x 100 | 50, 60, 70, 80, 90 | 2,500 - 8,100 | 50 |
| Squares above 100 x 100 | 150, 200, 300, 500, 700 | 22,500 - 490,000 | 50 |
| Shapes (same operations, other ratio) | 25 x 100, 100 x 25, 35 x 140, 140 x 35 | 2,500 / 4,900 | 40 |
| Machine axis (200 jobs) | 200 x 300, 200 x 500, 200 x 700 | 60,000 - 140,000 | 30 |
| Wide processing times (`sjsw`) | 60 x 60, 80 x 80 | 3,600 / 6,400 | 20 |

## Format

The standard text format: the first line holds the number of jobs and machines, then one line per job lists its
operations in route order as pairs of machine (numbered from 0) and processing time. Instances with 50,000 operations
or more are gzip-compressed (`.txt.gz`).

## Generation

All instances come from Taillard's generator (E. Taillard, "Benchmarks for basic scheduling problems", European
Journal of Operational Research 64, 1993): Lehmer's random number generator (multiplier 16807, modulus 2^31 - 1), the
processing times job by job from the time seed, each job's machine order from the identity by swaps with the machine
seed. The implementation (`benchmarks/taillard_generator.py`) reproduces all 80 Taillard instances exactly from their
seeds (`references/taillard_seeds.csv`).

The two seeds of every instance are in `sjs_seeds.csv`; they were drawn from the master seed 20261105 in the order of
the table above (all distinct). `generate.py` writes the set, `generate.py --check` regenerates it and compares file by
file; `checksums.sha256` holds the SHA-256 of every file.

## Licence and citation

Creative Commons Attribution 4.0 (CC BY 4.0). Please cite as: schweminOPT Job Shop Scaling set (SJS), version 1, 2026,
https://github.com/Marci172/schweminOPT-schedules.
