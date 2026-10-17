/*
 * OpenRocket reference harness for lo-fi-rocket.
 *
 * Copyright (C) 2026 lo-fi-rocket contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * ---------------------------------------------------------------------
 * Black-box probe (plan 0083): the five reference rockets' trapezoidal fin
 * dimensions, root leading edge and the fin set's CP, at Mach 0.3 and angle
 * of attack 0 (reference/rockets/cp-probe/fins.txt).
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/FinCpProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar FinCpProbe ../../reference/rockets
 */
import info.openrocket.core.aerodynamics.AerodynamicForces;
import info.openrocket.core.aerodynamics.BarrowmanCalculator;
import info.openrocket.core.aerodynamics.FlightConditions;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.logging.WarningSet;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.startup.OpenRocketCore;
import info.openrocket.core.util.Coordinate;
import java.io.File;
import java.util.Locale;
import java.util.Map;

public final class FinCpProbe {
  static double finCp(FlightConfiguration c) {
    FlightConditions fc = new FlightConditions(c); fc.setMach(0.3); fc.setAOA(0); fc.setRollRate(0);
    for (Map.Entry<RocketComponent, AerodynamicForces> e : new BarrowmanCalculator().getForceAnalysis(c, fc, new WarningSet()).entrySet())
      if (e.getKey() instanceof FinSet && e.getValue() != null) return e.getValue().getCP().x;
    return Double.NaN;
  }
  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    String[] files = { "r1-three-fin-conical", "r2-ogive-boattail", "r3-minimum-diameter-24", "r4-scratch-38mm", "r5-transonic-min-dia-29" };
    for (String fn : files) {
      Rocket r = new GeneralRocketLoader(new File(a[0], fn + ".ork")).load().getRocket();
      for (RocketComponent comp : r) {
        if (comp instanceof TrapezoidFinSet) {
          TrapezoidFinSet f = (TrapezoidFinSet) comp;
          Coordinate le = f.toAbsolute(Coordinate.NUL)[0];
          System.out.printf("ROCKET %s cr=%.9f ct=%.9f sweep=%.9f span=%.9f rootLE=%.9f CPx=%.9f%n", fn, f.getRootChord(), f.getTipChord(), f.getSweep(), f.getHeight(), le.x, finCp(r.getSelectedConfiguration()));
        }
      }
    }
  }
}
