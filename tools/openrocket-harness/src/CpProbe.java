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
 * Black-box probe (plan 0083): each component's normal force slope and CP,
 * and the total, for the five reference rockets at Mach 0.3 and at small
 * Mach, angle of attack 0 and the given angles, to locate the 0.016 to
 * 0.034 % CP residual against the closed forms.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/CpProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar CpProbe ../../reference/rockets
 */
import info.openrocket.core.aerodynamics.AerodynamicForces;
import info.openrocket.core.aerodynamics.BarrowmanCalculator;
import info.openrocket.core.aerodynamics.FlightConditions;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.logging.WarningSet;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.startup.OpenRocketCore;
import java.io.File;
import java.util.Locale;
import java.util.Map;

public final class CpProbe {
  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    String[] files = { "r1-three-fin-conical", "r2-ogive-boattail", "r3-minimum-diameter-24", "r4-scratch-38mm", "r5-transonic-min-dia-29" };
    double[][] cases = { { 0.3, 0.0 }, { 0.01, 0.0 }, { 0.3, 1e-6 }, { 0.3, Math.toRadians(1) } };
    for (String f : files) {
      Rocket r = new GeneralRocketLoader(new File(a[0], f + ".ork")).load().getRocket();
      FlightConfiguration c = r.getSelectedConfiguration();
      for (double[] cs : cases) {
        FlightConditions fc = new FlightConditions(c);
        fc.setMach(cs[0]); fc.setAOA(cs[1]); fc.setRollRate(0); fc.setTheta(0);
        BarrowmanCalculator calc = new BarrowmanCalculator();
        Map<RocketComponent, AerodynamicForces> map = calc.getForceAnalysis(c, fc, new WarningSet());
        System.out.printf("%s M=%.2f aoa=%.6f refArea=%.9f refLen=%.9f%n", f, cs[0], cs[1], fc.getRefArea(), fc.getRefLength());
        for (Map.Entry<RocketComponent, AerodynamicForces> e : map.entrySet()) {
          AerodynamicForces v = e.getValue();
          if (v == null) continue;
          System.out.printf("  %-28s CNa=%.9f CPx=%.9f%n", e.getKey().getComponentName() + "(" + e.getKey().getClass().getSimpleName() + ")", v.getCP().weight, v.getCP().x);
        }
        AerodynamicForces t = calc.getAerodynamicForces(c, fc, new WarningSet());
        System.out.printf("  TOTAL CNa=%.9f CPx=%.9f%n", t.getCP().weight, t.getCP().x);
      }
    }
  }
}
