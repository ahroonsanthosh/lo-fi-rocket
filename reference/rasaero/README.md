# RASAero II comparison harness (plans 0075 and 0077, D-114)

RASAero II 1.0.2.0 is Windows freeware by Charles E. Rogers and David Cooper (https://www.rasaero.com). These scripts run it as a black box in a Linux container, to compare its results with ours. Nothing of RASAero is committed: its installer, examples and outputs stay in the gitignored `download/`, `wine/`, `runs/` and `runs-ref/` folders. Its methods are not reproduced, and nothing is tuned to its results (CLAUDE.md 6.7).

## Needs

curl, unzip, msiextract (msitools), Wine 9.0 with a 32-bit prefix, Xvfb, xdotool and ImageMagick's `import`.

## Steps

1. **`./fetch-examples.sh`** downloads the installer and checks its SHA-256. It extracts the 24 example designs and `rasp.eng` into `download/RASAero II/`. This step needs no Wine.
2. **`./install-wine.sh`** installs wine-mono 8.1.0 (SHA-256 checked) and RASAero II into `wine/prefix`, and starts Xvfb on `:99` if none runs.
3. **`./run-rasaero.sh <file.CDX1> <outdir>`** opens the design, saves the Run Test output (`runtest_a0.txt`, manual pp. 89 to 92), the Aero Plots CSV (`aero.csv`) and the flight CSV (`flight.csv`), with screenshots. It takes about 65 s.

## The comparisons

- **RASAero's examples against their flights** (plan 0075). Run step 3 on each file of `download/RASAero II/Examples/` into `runs/<name>/`, where `<name>` is the file name with characters other than letters, digits, `-` and `_` replaced by `_`. Then run:

  ```
  RASAERO=1 pnpm vitest run packages/formats/src/rasaero-comparison.test.ts
  ```

  It writes `docs/reports/rasaero-comparison-data.md`.

- **R1 to R5 in three simulators** (plan 0077).
  1. Export the rockets and our motor files:

     ```
     RASAERO_EXPORT=1 pnpm vitest run packages/formats/src/rasaero-reference.test.ts
     ```

     This writes `runs-ref/<rocket>/<rocket>.CDX1` and `runs-ref/lofi-motors.eng`.

  2. Append `runs-ref/lofi-motors.eng` to `wine/prefix/drive_c/users/root/Documents/RASAero II/rasp.eng`. Its manual (p. 93) allows adding motors, and the renamed copies ("LF-D12", maker "LoFi") make RASAero fly exactly our thrust curves.
  3. Run step 3 on each exported file into its own folder.
  4. Run:

     ```
     RASAERO=1 pnpm vitest run packages/formats/src/rasaero-reference.test.ts
     ```

     It writes `docs/reports/rasaero-reference-rockets.md`.

## Fidelity

RASAero II's re-runs of its own examples under Wine give the apogees its authors saved on Windows within 0.0008 %, and the maximum velocities within 0.0002 %.
