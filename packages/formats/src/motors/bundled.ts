/**
 * The motor files bundled with the app and the MCP server (plan 0013; moved here from the app by
 * plan 0062): the eight RASP files of reference/motors, as text. A test checks each is
 * byte-identical to its file in reference/motors, whose provenance is in reference/SOURCES.md.
 */
export const BUNDLED_MOTOR_FILES: readonly { readonly file: string; readonly text: string }[] = [
  {
    file: 'Estes_C6.eng',
    text: '; Estes C6 RASP.ENG file made from NAR published data\r\n; File produced October 3, 2000\r\n; The total impulse, peak thrust, average thrust and burn time are\r\n; the same as the averaged static test data on the NAR web site in\r\n; the certification file. The curve drawn with these data points is as\r\n; close to the certification curve as can be with such a limited\r\n; number of points (32) allowed with wRASP up to v1.6.\r\nC6 18 70 0-3-5-7 .0108 .0231 E\r\n0.031 0.946\r\n0.092 4.826\r\n0.139 9.936\r\n0.192 14.090\r\n0.209 11.446\r\n0.231 7.381\r\n0.248 6.151\r\n0.292 5.489\r\n0.370 4.921\r\n0.475 4.448\r\n0.671 4.258\r\n0.702 4.542\r\n0.723 4.164\r\n0.850 4.448\r\n1.063 4.353\r\n1.211 4.353\r\n1.242 4.069\r\n1.303 4.258\r\n1.468 4.353\r\n1.656 4.448\r\n1.821 4.448\r\n1.834 2.933\r\n1.847 1.325\r\n1.860 0.000',
  },
  {
    file: 'Estes_D12.eng',
    text: ';\n;Estes D12 RASP.ENG file made from NAR published data\n;File produced October 3, 2000\n;The total impulse, peak thrust, average thrust and burn time are\n;the same as the averaged static test data on the NAR web site in\n;the certification file. The curve drawn with these data points is as\n;close to the certification curve as can be with such a limited\n;number of points (32) allowed with wRASP up to v1.6.\nD12 24 70 0-3-5-7 0.0211 0.0426 Estes \n0.049 2.569\n0.116 9.369\n0.184 17.275\n0.237 24.258\n0.282 29.73\n0.297 27.01\n0.311 22.589\n0.322 17.99\n0.348 14.126\n0.386 12.099\n0.442 10.808\n0.546 9.876\n0.718 9.306\n0.879 9.105\n1.066 8.901\n1.257 8.698\n1.436 8.31\n1.59 8.294\n1.612 4.613\n1.65 0',
  },
  {
    file: 'Estes_E16.eng',
    text: '; File produced, 2013\r\n; The total impulse, peak thrust, average thrust and burn time are\r\n; the same as the averaged static test data on the NAR web site in\r\n; the certification file. The curve drawn with these data points is as\r\n; close to the certification curve as can be with such a limited\r\n; number of points (32) allowed with wRASP up to v1.6.\r\nE16 29 114 0-4-6-8 .0400 .08200 E\r\n0.150 1.371\r\n0.186 1.920\r\n0.206 3.387\r\n0.242 5.587\r\n0.252 7.422\r\n0.277 8.705\r\n0.333 13.474\r\n0.359 15.858\r\n0.374 16.592\r\n0.394 18.609\r\n0.435 21.544\r\n0.476 24.661\r\n0.521 26.440\r\n0.643 21.720\r\n0.725 20.432\r\n0.821 19.511\r\n0.898 18.958\r\n1.025 18.219\r\n1.142 18.032\r\n1.259 17.844\r\n1.396 17.472\r\n1.569 17.282\r\n1.757 17.275\r\n1.895 17.086\r\n2.027 17.816\r\n2.042 12.494\r\n2.052 8.457\r\n2.063 4.970\r\n2.090 0.000',
  },
  {
    file: 'AeroTech_F39T.eng',
    text: '; Aerotech F39 RASP.ENG file made from NAR published data\r\n; File produced July 4, 2000\r\n; Submitted to ThrustCurve.org by Chris Kobel (4/6/07)\r\n; The total impulse, peak thrust, average thrust and burn time are\r\n; the same as the averaged static test data on the NAR web site in\r\n; the certification file. The curve drawn with these data points is as\r\n; close to the certification curve as can be with such a limited\r\n; number of points (32) allowed with wRASP up to v1.6.\r\nF39T  24   70   3-6-9   .0227   .059   AT\r\n   0.010   45.057\r\n   0.016   54.131\r\n   0.046   58.321\r\n   0.079   59.470\r\n   0.103   58.311\r\n   0.130   57.253\r\n   0.172   55.491\r\n   0.235   53.738\r\n   0.321   51.271\r\n   0.363   50.566\r\n   0.387   49.509\r\n   0.408   50.203\r\n   0.426   48.804\r\n   0.453   47.746\r\n   0.480   47.041\r\n   0.680   41.059\r\n   0.716   39.649\r\n   0.752   38.944\r\n   0.809   36.487\r\n   0.860   34.382\r\n   0.893   33.324\r\n   0.917   32.619\r\n   1.000   28.752\r\n   1.075   25.247\r\n   1.105   22.095\r\n   1.126   17.201\r\n   1.144   13.001\r\n   1.174    8.109\r\n   1.219    4.606\r\n   1.261    2.500\r\n   1.330    0.000',
  },
  {
    file: 'AeroTech_G80T.eng',
    text: ';G80 New Blue Thunder\r\nG80NBT 29 123.825 4-7-10 0.069 0.129 AT \r\n0.013 89.054\r\n0.018 101.584\r\n0.029 105.388\r\n0.047 102.927\r\n0.104 100.018\r\n0.19 102.255\r\n0.268 104.94\r\n0.306 104.269\r\n0.352 105.835\r\n0.41 104.94\r\n0.432 106.73\r\n0.512 105.612\r\n0.563 106.954\r\n0.591 104.493\r\n0.62 106.283\r\n0.715 103.15\r\n0.76 103.374\r\n0.806 101.36\r\n0.848 102.032\r\n1.2 88.383\r\n1.243 77.866\r\n1.269 57.952\r\n1.302 44.079\r\n1.329 34.011\r\n1.367 26.403\r\n1.398 22.823\r\n1.433 20.585\r\n1.48 21.704\r\n1.508 20.809\r\n1.584 13.201\r\n1.604 11.635\r\n1.652 11.188\r\n1.683 5.37\r\n1.701 0\r\n;',
  },
  {
    file: 'AeroTech_H128W.eng',
    text: '; AeroTech H128W\n; converted from TMT test stand data 1997 (www.tripoli.org)\n; provided by ThrustCurve.org (www.thrustcurve.org)\nH128W 29 194 14 0.09408 0.2016 AT\n   0.024 102.423\n   0.074 175.203\n   0.125 181.379\n   0.176 179.281\n   0.226 181.423\n   0.277 186.074\n   0.328 190.483\n   0.378 189.509\n   0.429 186.162\n   0.480 184.114\n   0.530 180.300\n   0.581 174.144\n   0.632 172.019\n   0.683 169.360\n   0.734 166.017\n   0.784 161.882\n   0.835 157.331\n   0.886 153.073\n   0.936 151.985\n   0.988 139.902\n   1.039 87.865\n   1.089 40.857\n   1.140 14.328\n   1.191 4.330\n   1.242 1.550\n   1.293 0.000',
  },
  {
    file: 'AeroTech_H238T.eng',
    text: '; AeroTech H238T\n; converted from TMT test stand data 1997 (www.tripoli.org)\n; provided by ThrustCurve.org (www.thrustcurve.org)\nH238T 29 194 6 0.08064 0.18816 AT\n   0.019 173.100\n   0.059 206.876\n   0.100 211.036\n   0.141 214.353\n   0.181 217.113\n   0.222 219.343\n   0.263 221.034\n   0.303 224.951\n   0.344 229.324\n   0.384 229.308\n   0.425 228.558\n   0.466 226.573\n   0.506 222.365\n   0.547 219.205\n   0.588 217.750\n   0.628 213.350\n   0.669 208.070\n   0.709 200.966\n   0.750 196.988\n   0.791 151.387\n   0.831 96.273\n   0.872 59.475\n   0.912 18.621\n   0.953 7.986\n   0.995 3.697\n   1.036 0.000',
  },
  {
    file: 'AeroTech_H123W.eng',
    text: '; AeroTech H123W\n; converted from TMT test stand data 1999 (www.tripoli.org)\n; provided by ThrustCurve.org (www.thrustcurve.org)\nH123W 38 154 0 0.126336 0.278656 AT\n   0.047 96.764\n   0.143 146.256\n   0.239 150.699\n   0.334 152.496\n   0.430 151.248\n   0.526 149.875\n   0.622 150.200\n   0.718 149.176\n   0.814 144.858\n   0.909 143.536\n   1.005 141.414\n   1.101 135.125\n   1.198 125.288\n   1.295 114.035\n   1.391 101.556\n   1.486 90.175\n   1.582 78.694\n   1.678 66.364\n   1.774 54.260\n   1.870 46.872\n   1.966 38.186\n   2.061 22.737\n   2.157 13.478\n   2.253 7.587\n   2.350 5.252\n   2.447 0.000',
  },
];
