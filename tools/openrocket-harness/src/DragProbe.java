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
 * Black-box probe (plan 0071): OpenRocket's drag coefficient at Mach 0.10,
 * 0.14 and 0.18 for each .ork file given, split into friction, pressure and
 * base, with the configuration's motors in place; then the rail buttons' and
 * launch lugs' share, found by removing them and computing again.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/DragProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar DragProbe [--transonic] [--sustainer] <file>...
 * "--transonic" uses Mach 0.1 to 0.95; "--sustainer" removes the stages below the top one from the files after it.
 */
import info.openrocket.core.aerodynamics.AerodynamicForces;
import info.openrocket.core.aerodynamics.BarrowmanCalculator;
import info.openrocket.core.aerodynamics.FlightConditions;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.logging.WarningSet;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.startup.OpenRocketCore;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class DragProbe {
  static AerodynamicForces at(FlightConfiguration config, double mach) {
    FlightConditions fc = new FlightConditions(config);
    fc.setMach(mach); fc.setAOA(0); fc.setRollRate(0);
    return new BarrowmanCalculator().getAerodynamicForces(config, fc, new WarningSet());
  }

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    boolean sustainer = false;
    double[] machs = { 0.10, 0.14, 0.18 };
    for (String f : a) {
      if (f.equals("--sustainer")) { sustainer = true; continue; }
      if (f.equals("--transonic")) { machs = new double[] { 0.1, 0.3, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95 }; continue; }
      String name = new File(f).getName();
      Rocket r = new GeneralRocketLoader(new File(f)).load().getRocket();
      if (sustainer) { while (r.getChildCount() > 1) r.removeChild(r.getChildCount() - 1); name = name + "[sustainer]"; }
      FlightConfiguration config = r.getSelectedConfiguration();
      for (double m : machs) {
        AerodynamicForces t = at(config, m);
        System.out.printf("%s: Mach %.2f static cd=%.5f friction=%.5f pressure=%.5f base=%.5f hasMotors=%b%n", name, m, t.getCD(), t.getFrictionCD(), t.getPressureCD(), t.getBaseCD(), config.hasMotors());
      }
      List<RocketComponent> parts = new ArrayList<>();
      for (RocketComponent k : r) if (k instanceof RailButton || k instanceof LaunchLug) parts.add(k);
      for (RocketComponent k : parts) {
        if (k instanceof RailButton) {
          RailButton b = (RailButton) k;
          System.out.printf("%s: rail buttons outerD=%.5f innerD=%.5f height=%.5f base=%.5f flange=%.5f instances=%d x=%.5f%n", name, b.getOuterDiameter(), b.getInnerDiameter(), b.getTotalHeight(), b.getBaseHeight(), b.getFlangeHeight(), b.getInstanceCount(), k.toAbsolute(info.openrocket.core.util.Coordinate.NUL)[0].x);
        } else {
          LaunchLug l = (LaunchLug) k;
          System.out.printf("%s: launch lug outerR=%.5f innerR=%.5f length=%.5f instances=%d x=%.5f%n", name, l.getOuterRadius(), l.getInnerRadius(), l.getLength(), l.getInstanceCount(), k.toAbsolute(info.openrocket.core.util.Coordinate.NUL)[0].x);
        }
      }
      double with = at(config, 0.1).getCD();
      for (RocketComponent k : parts) k.getParent().removeChild(k);
      double without = at(r.getSelectedConfiguration(), 0.1).getCD();
      System.out.printf("%s: Mach 0.10 cd with rail buttons and lugs=%.5f without=%.5f their drag=%.5f%n", name, with, without, with - without);
    }
  }
}
