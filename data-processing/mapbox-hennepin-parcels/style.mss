Map {
  background-color: transparent;
}

// Market value 0 - 6863000
@none: #F1F1F1;
@level1: #55307e;
@level2: #8e71a8;
@level3: #c6b6d3;
@level4: #b9d9bf;
@level5: #74b281;
@level6: #1d8c47;


#parcels {
  polygon-opacity:1;
  polygon-fill:@none;
  
  [MKT_VAL_TO > 1] {
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
  [MKT_VAL_TO > 3000000] {
    polygon-fill: @level6;
  }
}
