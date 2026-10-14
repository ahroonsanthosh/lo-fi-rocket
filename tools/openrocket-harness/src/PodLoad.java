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
 * Plan 0070 step 3: load each .ork file given (zipped or bare XML, for files
 * edited by hand) and print each pod set's front x and the distance of its
 * first instance from the axis, as OpenRocket places it.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/PodLoad.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar PodLoad <file>...
 */
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.startup.OpenRocketCore;
import info.openrocket.core.util.Coordinate;
import java.io.File;
import java.util.Locale;

public final class PodLoad {
  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    for (String f : a) {
      Rocket loaded = new GeneralRocketLoader(new File(f)).load().getRocket();
      for (RocketComponent k : loaded) {
        if (k instanceof PodSet) {
          Coordinate[] abs = k.toAbsolute(Coordinate.NUL);
          System.out.printf("%s: absX0=%.9f absR=%.9f n=%d%n", f, abs[0].x, Math.hypot(abs[0].y, abs[0].z), abs.length);
        }
      }
    }
  }
}
