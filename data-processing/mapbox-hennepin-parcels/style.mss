Map {
  background-color: transparent;
}

// Market value 0 - 6863000
@none: #F1F1F1;

@level1: #543005;
@level2: #8c510a;
@level3: #bf812d;
@level4: #dfc27d;

@level5: #c7eae5;
@level6: #80cdc1;
@level7: #35978f;
@level8: #01665e;
@level9: #003c30;

#parcels {
  polygon-opacity: 1;
  polygon-fill: @none;
  
  [MKT_VAL_TO > 0] {
    polygon-fill: @level1;
  }
  [MKT_VAL_TO > 100000] {
    polygon-fill: @level2;
  }
  [MKT_VAL_TO > 250000] {
    polygon-fill: @level3;
  }
  [MKT_VAL_TO > 500000] {
    polygon-fill: @level4;
  }
  [MKT_VAL_TO > 1000000] {
    polygon-fill: @level5;
  }
  [MKT_VAL_TO > 2000000] {
    polygon-fill: @level6;
  }
  [MKT_VAL_TO > 5000000] {
    polygon-fill: @level7;
  }
  [MKT_VAL_TO > 20000000] {
    polygon-fill: @level8;
  }
  [MKT_VAL_TO > 100000000] {
    polygon-fill: @level9;
  }
}
