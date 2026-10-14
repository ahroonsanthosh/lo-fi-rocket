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
 * Black-box probe (plan 0073 part 3): the mass, CG and inertia OpenRocket
 * gives a fin set's fillets, against the fillet radius, the body radius, the
 * root chord, the fin count, the fin shape and the fillet material. Each case
 * is saved, reloaded and measured as loaded; the fin set with and without its
 * fillet. Output kept in reference/rockets/fillet-probe/.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/FilletProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar FilletProbe
 */
import info.openrocket.core.document.*;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.file.GeneralRocketSaver;
import info.openrocket.core.material.Material;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.rocketcomponent.position.AxialMethod;
import info.openrocket.core.startup.OpenRocketCore;
import info.openrocket.core.util.Coordinate;
import java.io.*;
import java.util.Locale;

public final class FilletProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    // tag, shape (0 trapezoid, 1 elliptical, 2 freeform), body radius, root, tip, sweep, span,
    // thickness, count, fillet radius, fillet density
    Object[][] cases = {
      {"r0", 0, 0.025, 0.1, 0.05, 0.05, 0.08, 0.003, 3, 0.0, 680.0},
      {"r3", 0, 0.025, 0.1, 0.05, 0.05, 0.08, 0.003, 3, 0.003, 680.0},
      {"r6", 0, 0.025, 0.1, 0.05, 0.05, 0.08, 0.003, 3, 0.006, 680.0},
      {"r10", 0, 0.025, 0.1, 0.05, 0.05, 0.08, 0.003, 3, 0.010, 680.0},
      {"r6-n4", 0, 0.025, 0.1, 0.05, 0.05, 0.08, 0.003, 4, 0.006, 680.0},
      {"r6-n1", 0, 0.025, 0.1, 0.05, 0.05, 0.08, 0.003, 1, 0.006, 680.0},
      {"r6-rho1000", 0, 0.025, 0.1, 0.05, 0.05, 0.08, 0.003, 3, 0.006, 1000.0},
      {"r6-root200", 0, 0.025, 0.2, 0.05, 0.05, 0.08, 0.003, 3, 0.006, 680.0},
      {"r6-body12", 0, 0.0125, 0.1, 0.05, 0.05, 0.08, 0.003, 3, 0.006, 680.0},
      {"r6-body50", 0, 0.05, 0.1, 0.05, 0.05, 0.08, 0.003, 3, 0.006, 680.0},
      {"r6-body500", 0, 0.5, 0.1, 0.05, 0.05, 0.08, 0.003, 3, 0.006, 680.0},
      {"r6-t6", 0, 0.025, 0.1, 0.05, 0.05, 0.08, 0.006, 3, 0.006, 680.0},
      {"r6-t1", 0, 0.025, 0.1, 0.05, 0.05, 0.08, 0.001, 3, 0.006, 680.0},
      {"r6-ellip", 1, 0.025, 0.1, 0.0, 0.0, 0.08, 0.003, 3, 0.006, 680.0},
      {"r6-free", 2, 0.025, 0.1, 0.05, 0.05, 0.08, 0.003, 3, 0.006, 680.0},
      {"r0-ellip", 1, 0.025, 0.1, 0.0, 0.0, 0.08, 0.003, 3, 0.0, 680.0},
      {"r0-free", 2, 0.025, 0.1, 0.05, 0.05, 0.08, 0.003, 3, 0.0, 680.0},
    };
    for (Object[] c : cases) run(c);
  }

  static void run(Object[] c) throws Exception {
    String tag = (String) c[0];
    int shape = (Integer) c[1];
    double body = (Double) c[2], root = (Double) c[3], tip = (Double) c[4], sweep = (Double) c[5];
    double span = (Double) c[6], thick = (Double) c[7];
    int count = (Integer) c[8];
    double fillet = (Double) c[9], rho = (Double) c[10];
    Rocket r = new Rocket(); r.setName(tag);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.CONICAL, 0.1, body);
    nose.setFilled(true); nose.setMaterial(bulk("balsa160", 160)); st.addChild(nose);
    BodyTube bt = new BodyTube(0.5, body, 0.001); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt); bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    FinSet fins;
    if (shape == 0) {
      fins = new TrapezoidFinSet(count, root, tip, sweep, span);
    } else if (shape == 1) {
      EllipticalFinSet e = new EllipticalFinSet();
      e.setFinCount(count); e.setLength(root); e.setHeight(span);
      fins = e;
    } else {
      FreeformFinSet f = new FreeformFinSet();
      f.setFinCount(count);
      f.setPoints(new Coordinate[] {
        new Coordinate(0, 0), new Coordinate(sweep, span), new Coordinate(sweep + tip, span),
        new Coordinate(root, 0)});
      fins = f;
    }
    fins.setThickness(thick); fins.setMaterial(bulk("ply630", 630));
    fins.setFilletRadius(fillet); fins.setFilletMaterial(bulk("fillet" + rho, rho));
    bt.addChild(fins); fins.setAxialMethod(AxialMethod.BOTTOM); fins.setAxialOffset(0.0);
    File f = new File("fillet-" + tag + ".ork");
    new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    Rocket loaded = new GeneralRocketLoader(f).load().getRocket();
    for (RocketComponent k : loaded) {
      if (!(k instanceof FinSet)) continue;
      FinSet fs = (FinSet) k;
      Coordinate cg = fs.getComponentCG();
      System.out.printf(
          "%s shape=%d body=%.4f root=%.4f tip=%.4f sweep=%.4f span=%.4f t=%.4f n=%d fillet=%.4f rho=%.1f "
              + "mass=%.9e volume=%.9e cgx=%.9f cgy=%.9e Irot=%.9e Ilong=%.9e finArea=%.9e%n",
          tag, shape, body, root, tip, sweep, span, thick, count, fillet, rho, fs.getComponentMass(),
          fs.getComponentVolume(), cg.x, cg.y, fs.getRotationalUnitInertia(), fs.getLongitudinalUnitInertia(),
          fs.getPlanformArea());
    }
  }
}
