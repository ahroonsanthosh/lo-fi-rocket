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
 * Black-box probe (D-078): which flight configuration OpenRocket opens a file
 * in. Pass .ork paths as arguments; for each it prints the index of the
 * selected configuration among the file's configurations (-1: OpenRocket's own
 * empty default configuration, used when none of several is marked default).
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/SelProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar SelProbe a.ork b.ork
 */
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.startup.OpenRocketCore;
import java.io.File;
import java.util.Locale;
public final class SelProbe {
  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    for (String p : a) {
      Rocket r = new GeneralRocketLoader(new File(p)).load().getRocket();
      FlightConfiguration sel = r.getSelectedConfiguration();
      System.out.printf("%s: selected index %d of %d, id %s%n", new File(p).getName(), r.getIds().indexOf(sel.getId()), r.getIds().size(), sel.getId());
      int i = 0; for (FlightConfigurationId id : r.getIds()) System.out.printf("   %d %s%n", i++, id);
    }
  }
}
