import {
  MAT_SELECT_CONFIG,
  MAT_SELECT_SCROLL_STRATEGY,
  MAT_SELECT_SCROLL_STRATEGY_PROVIDER,
  MAT_SELECT_SCROLL_STRATEGY_PROVIDER_FACTORY,
  MAT_SELECT_TRIGGER,
  MatSelect,
  MatSelectChange,
  MatSelectModule,
  MatSelectTrigger
} from "./chunk-EQIEW3FC.js";
import "./chunk-MJB3QF3L.js";
import "./chunk-4LRFTLRA.js";
import {
  MatOptgroup,
  MatOption
} from "./chunk-JQKJSP6N.js";
import "./chunk-IU5IHU4U.js";
import "./chunk-SC4E2GZB.js";
import "./chunk-YI3BD6AH.js";
import "./chunk-36QNWLDZ.js";
import {
  MatError,
  MatFormField,
  MatHint,
  MatLabel,
  MatPrefix,
  MatSuffix
} from "./chunk-SGOB3LRU.js";
import "./chunk-OGNW5CTO.js";
import "./chunk-IZUQEQ72.js";
import "./chunk-2KLVXJTL.js";
import "./chunk-T6XAKLRL.js";
import "./chunk-TXO6K4P2.js";
import "./chunk-3H7K65UV.js";
import "./chunk-GDPYZP4F.js";
import "./chunk-FKHPDPVT.js";
import "./chunk-TKTTFTR2.js";
import "./chunk-PACM6WKL.js";
import "./chunk-TBVFUTTZ.js";
import "./chunk-V4SKFIHQ.js";
import "./chunk-NRBIPIUI.js";
import "./chunk-FQWCZMUM.js";
import "./chunk-YQ2VH4YR.js";
import "./chunk-ZZ237XET.js";
import "./chunk-KVLYFCTM.js";
import "./chunk-DRV5L7CY.js";
import "./chunk-AMR6B56L.js";
import "./chunk-WDMUDEB6.js";

// ../../../node_modules/@angular/material/fesm2022/select.mjs
var matSelectAnimations = {
  // Represents
  // trigger('transformPanel', [
  //   state(
  //     'void',
  //     style({
  //       opacity: 0,
  //       transform: 'scale(1, 0.8)',
  //     }),
  //   ),
  //   transition(
  //     'void => showing',
  //     animate(
  //       '120ms cubic-bezier(0, 0, 0.2, 1)',
  //       style({
  //         opacity: 1,
  //         transform: 'scale(1, 1)',
  //       }),
  //     ),
  //   ),
  //   transition('* => void', animate('100ms linear', style({opacity: 0}))),
  // ])
  /** This animation transforms the select's overlay panel on and off the page. */
  transformPanel: {
    type: 7,
    name: "transformPanel",
    definitions: [
      {
        type: 0,
        name: "void",
        styles: {
          type: 6,
          styles: { opacity: 0, transform: "scale(1, 0.8)" },
          offset: null
        }
      },
      {
        type: 1,
        expr: "void => showing",
        animation: {
          type: 4,
          styles: {
            type: 6,
            styles: { opacity: 1, transform: "scale(1, 1)" },
            offset: null
          },
          timings: "120ms cubic-bezier(0, 0, 0.2, 1)"
        },
        options: null
      },
      {
        type: 1,
        expr: "* => void",
        animation: {
          type: 4,
          styles: { type: 6, styles: { opacity: 0 }, offset: null },
          timings: "100ms linear"
        },
        options: null
      }
    ],
    options: {}
  }
};
export {
  MAT_SELECT_CONFIG,
  MAT_SELECT_SCROLL_STRATEGY,
  MAT_SELECT_SCROLL_STRATEGY_PROVIDER,
  MAT_SELECT_SCROLL_STRATEGY_PROVIDER_FACTORY,
  MAT_SELECT_TRIGGER,
  MatError,
  MatFormField,
  MatHint,
  MatLabel,
  MatOptgroup,
  MatOption,
  MatPrefix,
  MatSelect,
  MatSelectChange,
  MatSelectModule,
  MatSelectTrigger,
  MatSuffix,
  matSelectAnimations
};
//# sourceMappingURL=@angular_material_select.js.map
