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
 * Black-box probe (plan 0071): each part's drag coefficient (friction,
 * pressure, base; fins per fin) of an .ork file at the Mach numbers given,
 * at zero angle of attack and OpenRocket's static conditions; with
 * "--sustainer" the stages below the top one are removed first.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/PartDrag.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar PartDrag <file> 0.1,0.5,0.85 [--sustainer]
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

public final class PartDrag {
  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    Rocket r = new GeneralRocketLoader(new File(a[0])).load().getRocket();
    if (a.length > 2 && a[2].equals("--sustainer")) while (r.getChildCount() > 1) r.removeChild(r.getChildCount() - 1);
    FlightConfiguration config = r.getSelectedConfiguration();
    for (String ms : a[1].split(",")) {
      double m = Double.parseDouble(ms);
      FlightConditions fc = new FlightConditions(config);
      fc.setMach(m); fc.setAOA(0); fc.setRollRate(0);
      Map<RocketComponent, AerodynamicForces> map = new BarrowmanCalculator().getForceAnalysis(config, fc, new WarningSet());
      for (Map.Entry<RocketComponent, AerodynamicForces> e : map.entrySet()) {
        AerodynamicForces f = e.getValue();
        if (f == null) continue;
        System.out.printf("PART M=%.2f %s \"%s\" cd=%.5f friction=%.5f pressure=%.5f base=%.5f%n", m, e.getKey().getClass().getSimpleName(), e.getKey().getName(), f.getCD(), f.getFrictionCD(), f.getPressureCD(), f.getBaseCD());
      }
    }
  }
}
