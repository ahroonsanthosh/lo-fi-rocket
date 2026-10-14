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
 * Black-box probe (plan 0071): a nose cone's pressure drag coefficient
 * against Mach (0.05 to 3) for each shape (conical, ogive 1 and 0.5,
 * ellipsoid, power 0.5, parabolic 0.75, Haack 0) and fineness ratio (1, 2,
 * 3, 5), a 25 mm nose on a 0.5 m tube, at OpenRocket's static conditions.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/NoseProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar NoseProbe
 */
import info.openrocket.core.aerodynamics.AerodynamicForces;
import info.openrocket.core.aerodynamics.BarrowmanCalculator;
import info.openrocket.core.aerodynamics.FlightConditions;
import info.openrocket.core.document.OpenRocketDocumentFactory;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.file.GeneralRocketSaver;
import info.openrocket.core.logging.WarningSet;
import info.openrocket.core.material.Material;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.rocketcomponent.position.AxialMethod;
import info.openrocket.core.startup.OpenRocketCore;
import java.io.File;
import java.util.Locale;
import java.util.Map;

public final class NoseProbe {
  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    Object[][] shapes = { { Transition.Shape.CONICAL, 0.0 }, { Transition.Shape.OGIVE, 1.0 }, { Transition.Shape.OGIVE, 0.5 }, { Transition.Shape.ELLIPSOID, 0.0 }, { Transition.Shape.POWER, 0.5 }, { Transition.Shape.PARABOLIC, 0.75 }, { Transition.Shape.HAACK, 0.0 } };
    double[] fineness = { 1.0, 2.0, 3.0, 5.0 };
    double[] machs = { 0.05, 0.1, 0.3, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.98, 1.0, 1.05, 1.1, 1.2, 1.3, 1.5, 2.0, 3.0 };
    for (Object[] sh : shapes) {
      for (double f : fineness) {
        Rocket r = new Rocket(); AxialStage st = new AxialStage(); r.addChild(st);
        NoseCone n = new NoseCone((Transition.Shape) sh[0], f * 0.05, 0.025);
        n.setShapeParameter((Double) sh[1]); n.setFilled(true); n.setMaterial(Material.newMaterial(Material.Type.BULK, "b", 160, true));
        st.addChild(n);
        BodyTube bt = new BodyTube(0.5, 0.025, 0.001); bt.setMaterial(Material.newMaterial(Material.Type.BULK, "p", 700, true)); st.addChild(bt);
        bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0);
        File file = File.createTempFile("nose", ".ork");
        new GeneralRocketSaver().save(file, OpenRocketDocumentFactory.createDocumentFromRocket(r));
        Rocket lr = new GeneralRocketLoader(file).load().getRocket(); file.delete();
        FlightConfiguration c = lr.getSelectedConfiguration();
        StringBuilder sb = new StringBuilder();
        for (double m : machs) {
          FlightConditions fc = new FlightConditions(c); fc.setMach(m); fc.setAOA(0); fc.setRollRate(0);
          Map<RocketComponent, AerodynamicForces> map = new BarrowmanCalculator().getForceAnalysis(c, fc, new WarningSet());
          for (Map.Entry<RocketComponent, AerodynamicForces> e : map.entrySet()) if (e.getKey() instanceof NoseCone && e.getValue() != null) sb.append(String.format(Locale.US, " %.2f:%.5f", m, e.getValue().getPressureCD()));
        }
        System.out.printf("NOSE %s k=%.2f f=%.1f%s%n", sh[0], (Double) sh[1], f, sb);
      }
    }
  }
}
