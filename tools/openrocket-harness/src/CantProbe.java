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
 * Black-box probe (D-085): the unit of <cant> in an .ork file. A fin set
 * canted 2 degrees is saved, reloaded and its cant printed in radians; the
 * file itself shows the written value. Output kept in
 * reference/rockets/cant-probe/.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/CantProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar CantProbe
 */
import info.openrocket.core.document.*;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.file.GeneralRocketSaver;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.startup.OpenRocketCore;
import java.io.*;
import java.util.Locale;

public final class CantProbe {
  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    Rocket r = new Rocket(); r.setName("cant");
    AxialStage st = new AxialStage(); r.addChild(st);
    BodyTube bt = new BodyTube(0.5, 0.025, 0.001); st.addChild(bt);
    TrapezoidFinSet fins = new TrapezoidFinSet(3, 0.1, 0.05, 0.05, 0.08); bt.addChild(fins);
    fins.setCantAngle(Math.toRadians(2.0));
    File f = new File("cant.ork");
    new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    Rocket loaded = new GeneralRocketLoader(f).load().getRocket();
    for (RocketComponent k : loaded) {
      if (k instanceof FinSet) System.out.printf("set 2 degrees; loaded cant = %.9f rad%n", ((FinSet) k).getCantAngle());
    }
  }
}
