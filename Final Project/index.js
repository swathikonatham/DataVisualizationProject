/*
@ Name - createIllinoisMap
@ Params - geoJsonData, mapData, originalMapData, mapSvg, bubbleSvg, groupBarSvg,
            sunburstSvg, H1Petitions_CountData, topEmployersList, width, height 
@ Description - Creates Illinois Map.
*/
function createIllinoisMap(geoJsonData, mapData, originalMapData, mapSvg, bubbleSvg, groupBarSvg,
  sunburstSvg, H1Petitions_CountData, topEmployersList, width, height) {
  mapSvg.selectAll("*").remove();
  var projection = d3.geoTransverseMercator()
    .rotate([88 + 20 / 60, -36 - 40 / 60])
    .fitExtent([[0, 0], [width, height - 10]], geoJsonData);

  var div = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("visibility", "hidden");

  var path = d3.geoPath()
    .projection(projection);

  mapSvg.selectAll("path")
    .data(geoJsonData.features)
    .enter().append("path")
    .attr("d", path)
    .style("stroke", "black")
    .attr("class", "counties")
    .append("title")
    .text(d => d.properties.COUNTY_NAM);

  mapSvg.selectAll("circle")
    .data(mapData)
    .join("circle")
    .attr("class", "circles")
    .attr("transform", function (d) {
      return "translate(" + projection([d.lon, d.lat]) + ")";
    })
    .attr("r", function (d) {
      return "5px";
    })
    .attr("fill", function (d) {
      return "black";
    })
    .classed("highlight", false)
    /*On Mouseover display the H1 petitions count applied from the selected worksite location */
    .on("mouseover", function (d) {
      div.html('Worksite: ' + d.WORKSITE + '<br><br> H1 Petitions count: ' + getH1PetitionsCount(d.WORKSITE, d.YEAR, H1Petitions_CountData))
        .style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px")
        .style("visibility", "visible");
    })
    .on("mouseleave", function () {
      div.style("visibility", "hidden");
    });

  createBubbleChart(topEmployersList, groupBarSvg, bubbleSvg, originalMapData, mapData, sunburstSvg);

}

/*
@ Name - createBubbleChart
@ Params - topEmployersList, groupBarSvg, bubbleSvg, originalMapData, mapData, sunburstSvg
@ Description - Creates bubble chart with top list of employers.
*/

function createBubbleChart(topEmployersList, groupBarSvg, bubbleSvg, originalMapData, mapData, sunburstSvg) {

  bubbleSvg.selectAll("*").remove();
  var circleColor = d3.scaleOrdinal()
    .range(d3.schemeCategory10);

  const margin = { top: 10, right: 30, bottom: 50, left: 70 },
    width = +bubbleSvg.attr("width") - margin.left - margin.right,
    height = +bubbleSvg.attr("height") - margin.top - margin.bottom;

  var div = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("visibility", "hidden");

  //Logic to create Bubble chart
  bubbleSvg = bubbleSvg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
  const xScale = d3.scaleLinear()
    .domain([0, 150000])
    .range([0, width]);

  const yScale = d3.scaleLinear()
    .domain([0, 7000])
    .range([height, 0]);
  var entries = d3.entries(topEmployersList);

  bubbleLegend = bubbleSvg => {
    const g = bubbleSvg
      .attr("transform", `translate(${width},0)`)
      .attr("text-anchor", "end")
      .attr("font-family", "sans-serif")
      .attr("font-size", 10)
      .selectAll("g")
      .data(circleColor.domain().slice())
      .join("g")
      .attr("transform", (d, i) => `translate(0,${i * 20})`)

    bubbleSvg.selectAll("myBubble")
      .data(circleColor.domain().slice())
      .enter()
      .append("circle")
      .attr("cx", -30)
      .attr("cy", function (d, i) { return 10 + ((20 * i)); })
      .attr("r", 7)
      .style("fill", function (d) { return circleColor(d) });      

    g.append("text")
      .attr("x", -40)
      .attr("y", 9.5)
      .attr("dy", "0.35em")
      .text(d => d);
  }

  /*Logic to get the related worksite location of the top employers displayed in the bubble chart */
  var employerWorksite = {};
  mapData.forEach(function (rows) {
    var key = rows.EMPLOYER_NAME;
    topEmployersList.forEach(function (e) {
      if (!employerWorksite[key] && e.employer == key) {
        employerWorksite[key] = { worksite: rows.WORKSITE };
      }
    });
  });

  const bubbleDiv = d3.select("h1-petitions-map .bubble");
  var selEmployersList = [];

  //Logic that is invoked on click of bubbles
  var handlebubbleClick = function (val) {
    if (val['isDotSelected'] == undefined) {
      val['isDotSelected'] = true;
    }
    else {
      val['isDotSelected'] = !val['isDotSelected'];
    }
    var selEmployer = d3.select(this);

    /*Logic to highlight the employer related worksite in choropleth map using the same color
    encoding as that of bubble chart */
    const modifiedSvg = d3.selectAll("#h1-petitions-map .petitions .map .circles")
      .filter(d => {
        if (employerWorksite[val.value.employer]) {
          if (d.WORKSITE === employerWorksite[val.value.employer].worksite) {
            return true;
          }
        }
      })
      .style("fill", d => {
        if (employerWorksite[val.value.employer]) {
          if (d.WORKSITE === employerWorksite[val.value.employer].worksite) {
            return circleColor(val.value.employer);
          }
        }
      })

    if (val['isDotSelected']) {
      selEmployer.classed("highlight", true);
      modifiedSvg.style("stroke", "white")
        .style("stroke-width", "2px")
        .attr("r", 10)
        .classed("highlight", true).raise()
      selEmployersList.push(val.value.employer);
      createGroupBarChart(selEmployersList, originalMapData, groupBarSvg);

      /*Logic to encode Grouped bar chart with same color encoding as that of Bubble chart.
      Using brightness to encode the year values (ordered attribute) */
      const groupSvg = d3.selectAll("#h1-petitions-map .groupBar .bars")
        .style("fill", d => {
          var yearVal = d.value.split('-')[2];
          var barColor;

          //To generate color saturation for the selected categorical color hue.
          if (yearVal == '2014') {
            barColor = d3.hsl(circleColor(d.value.split('-')[1])).brighter(1);
          }
          else if (yearVal == '2015') {
            barColor = d3.hsl(circleColor(d.value.split('-')[1])).brighter(0.5);
          }
          else {
            barColor = d3.hsl(circleColor(d.value.split('-')[1])).brighter(0);
          }
          return barColor;
        });

      createSunburstChart(selEmployersList, mapData, sunburstSvg);

      /*Logic to encode Sunburst chart with same color encoding as that of Bubble chart.
      Using brightness to encode the year values (ordered attribute) */
      const sunburstSvgVal = d3.selectAll("#h1-petitions-map .sunburstChart .pie")
        .style("fill", d => {
          while (d.depth > 1) {
            d = d.parent;
          }
          return circleColor(d.data.name);
        })
      sunburstSvgVal.style("stroke", "white")
        .style("stroke-width", "2")
        .classed("highlight", true).raise();
    }
    else {
      selEmployer.classed("highlight", false);
      modifiedSvg.style("stroke", "black")
        .style("stroke-width", "0px")
        .attr("r", "5px")
        .classed("highlight", false).raise();

      /*Remove deselected employer from the list which will be used to update Grouped bar chart 
      and sunburst chart */
      selEmployersList.splice(selEmployersList.indexOf(val.value.employer), 1);

      createGroupBarChart(selEmployersList, originalMapData, groupBarSvg);
      const groupSvg = d3.selectAll("#h1-petitions-map .groupBar .bars")
        .style("fill", d => {
          var yearVal = d.value.split('-')[2];
          var barColor;
          if (yearVal == '2014') {
            barColor = d3.hsl(circleColor(d.value.split('-')[1])).brighter(1);
          }
          else if (yearVal == '2015') {
            barColor = d3.hsl(circleColor(d.value.split('-')[1])).brighter(0.5);
          }
          else {
            barColor = d3.hsl(circleColor(d.value.split('-')[1])).brighter(0);
          }
          return barColor;
        });

      createSunburstChart(selEmployersList, mapData, sunburstSvg);
      const sunburstSvgVal = d3.selectAll("#h1-petitions-map .sunburstChart .pie")
        .style("fill", d => {
          while (d.depth > 1) {
            d = d.parent;
          }
          return circleColor(d.data.name);
        })
      sunburstSvgVal.style("stroke", "white")
        .style("stroke-width", "2")
        .classed("highlight", true).raise();
    }

  }

  const dot = bubbleSvg.selectAll(".dot")
    .data(entries)
    .join("circle")
    .attr("class", function (d) { return "bubbles " + d.value.year }) //assigning dynamic class
    .attr("cx", function (d, i) {
      return xScale((d.value.wage / 10) * (i + 1));
    })
    .attr("cy", function (d) {
      return yScale(d.value.petitionsCount);
    })
    .attr("r", d => d.value.petitionsCount / 80)
    .attr("class", "dot")
    .style("fill", d => circleColor(d.value.employer))
    .style("stroke", "black")
    .style("stroke-width", "1px")
    .on("mouseover", function (d) {
      div.style("visibility", "visible");
      div.html("Employer: " + d.value.employer + "<br>" + "H1 Petitions: " + d.value.petitionsCount)
        .style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px")
    })
    .on("mouseleave", function () {
      d3.select(this)
        .style("visibility", "visible");
      div.style("visibility", "hidden");
    })
    .on("click", handlebubbleClick)
    .transition()
      .duration(300);

  bubbleSvg.append("g")
    .attr("class", "axis axis--x")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(xScale)
      .tickFormat(d3.format(".2s")));

  bubbleSvg.append("g")
    .attr("class", "axis axis--y")
    .call(d3.axisLeft(yScale)
      .tickFormat(d3.format(".2s")));

  bubbleSvg.append("text")
    .attr("class", "label")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .text("Prevailing Wage");

  bubbleSvg.append("text")
    .attr("class", "label")
    .attr("x", -40)
    .attr("y", height / 2)
    .attr("transform", "rotate(-90,-40," + (height / 2) + ")")
    .style("text-anchor", "center")
    .text("No of H1 Petitions");

  bubbleSvg.append("g")
    .call(bubbleLegend);

  /* On page load, below logic is used to color encode the top employers displayed as circles 
  in choropleth map with same color encoding as Bubbles */

  d3.selectAll("#h1-petitions-map .petitions .map .circles")
    .classed("highlight", false).raise();

  d3.selectAll("#h1-petitions-map .petitions .map .circles")
    .filter(d => {
      if (employerWorksite[d.EMPLOYER_NAME]) {
        if (d.WORKSITE === employerWorksite[d.EMPLOYER_NAME].worksite) {
          return true;
        }
      }
    })
    .style("fill", d => {
      if (employerWorksite[d.EMPLOYER_NAME]) {
        if (d.WORKSITE === employerWorksite[d.EMPLOYER_NAME].worksite) {
          return circleColor(d.EMPLOYER_NAME);
        }
      }
    })
    .style("stroke", "black")
    .style("stroke-width", "2px")
    .classed("highlight", true).raise();
}

/*
@ Name - createSunburstChart
@ Params - selEmployersList, originalMapData, sunburstSvg
@ Description - Creates pie chart displaying the status of H1B petitions for selected employers.
*/
function createSunburstChart(selEmployersList, originalMapData, sunburstSvg) {
  //Check if any selected employer exists in the List, If not removes the entire Sunburst chart.
  if (Array.isArray(selEmployersList) && selEmployersList.length) {
    sunburstSvg.selectAll("*").remove(); //To remove previous values from svg
    var employerPetitionsStatus = {};
    var employerPetitionsStatusList = [];

    /* Iterate through the initial data and find the count of H1 petitions for 
    each status by employer and selected year */
    originalMapData.forEach(function (data) {
      var key;
      key = data.EMPLOYER_NAME;
      selEmployersList.forEach(function (selectedEmployer) {
        if (data.EMPLOYER_NAME == selectedEmployer) {
          if (!employerPetitionsStatus[key]) {
            employerPetitionsStatus[key] = {
              year: data.YEAR, certifiedStatus: 0, certWithdrawnStatus: 0,
              withdrawnStatus: 0, deniedStatus: 0, employerName: data.EMPLOYER_NAME
            };
          }
          if (data.CASE_STATUS == 'CERTIFIED')
            employerPetitionsStatus[key].certifiedStatus++;
          if (data.CASE_STATUS == 'CERTIFIED-WITHDRAWN')
            employerPetitionsStatus[key].certWithdrawnStatus++;
          if (data.CASE_STATUS == 'WITHDRAWN')
            employerPetitionsStatus[key].withdrawnStatus++;
          if (data.CASE_STATUS == 'DENIED')
            employerPetitionsStatus[key].deniedStatus++;
        }
      })
    });

    Object.keys(employerPetitionsStatus).forEach(function (key) {
      employerPetitionsStatusList.push(employerPetitionsStatus[key]);
    });

    var newPetitionsSet = [];
    var data = new Object();
    /* Create the JSON format of the data using object in such a way it can be used to
    draw Sunburst chart */
    selEmployersList.forEach(selectedEmployer => {
      var statusOfPetitions = new Object();
      employerPetitionsStatusList.forEach(element => {
        if (element.employerName === selectedEmployer) {
          statusOfPetitions["name"] = element.employerName;
          var statusValues = [];
          statusValues.push({ "name": "CERTIFIED", "value": element.certifiedStatus },
            { "name": "CERTIFIED-WITHDRAWN", "value": element.certWithdrawnStatus },
            { "name": "WITHDRAWN", "value": element.withdrawnStatus },
            { "name": "DENIED", "value": element.deniedStatus })
          statusOfPetitions["children"] = statusValues;
        }
      });
      newPetitionsSet.push(statusOfPetitions);
    });
    data["children"] = newPetitionsSet;

    const margin = { top: 250, right: 60, bottom: 20, left: 250 },
      width = +sunburstSvg.attr("width") - margin.left - margin.right,
      height = +sunburstSvg.attr("height") - margin.top - margin.bottom;

    sunburstSvg = sunburstSvg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    //Display the label of Suburst chart
    document.getElementById("labelId").style = "display:block";

    //Logic to create Sunburst chart
    var radius = 80;
    const x = d3.scaleLinear()
      .range([0, 2 * Math.PI])
      .clamp(true);

    const y = d3.scaleSqrt()
      .range([radius * .1, radius]);
    var arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .innerRadius(d => (d.y0 * radius))
      .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

    var partition = data => {
      const root = d3.hierarchy(data)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);
      return d3.partition()
        .size([2 * Math.PI, root.height + 1])
        (root);
    }
    const root = partition(data);

    root.each(d => d.current = d);

    svgValue = sunburstSvg.selectAll("sunburstChart")
      .data(root.descendants().slice(1))
      .join("path")
      .attr("class", "pie")
      .classed("highlight", false)
      .attr("id", function (d, i) { return "arcId_" + i; }) //assigning dynamic Id
      .attr("d", d => arc(d.current))
      .style('stroke', '#fff')
      .attr("stroke-width", "2")
      //On Mouseover display the status and count of H1 petitions for the selected Employer
      .on("mouseover", function (d) {
        document.getElementById("textId").innerHTML = d.ancestors().map(d => d.data.name).reverse().join("<br/>") + '<br/>' + 'Count: ' + d.value;
        d3.select(this).style("opacity", 0.3);
      })
      .on("mouseleave", function (d) {
        d3.selectAll("path").style("opacity", 1);
        document.getElementById("textId").innerHTML = "";
      });

    svgValue.append("title")
      .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("\n")}\n${(d.value)}`);

    const text = svgValue.append('text')
      .attr('display', function (d) {
        if (d.data.name.length * 6 < (Math.max(0, (y(d.y0) + y(d.y1)) / 2) * (x(d.x1) - x(d.x0)))) {
          return null;
        }
        else {
          return 'none';
        }
      })

    text.append('textPath')
      .attr('startOffset', '50%')
      .attr('xlink:href', function (d, i) { return "arcId_" + i; })
      .text(d => { d.data.name })
      .style('stroke', '#fff')
      .style('stroke-width', 5)
      .style('stroke-linejoin', 'round');

    text.append('textPath')
      .attr('startOffset', '50%')
      .attr('xlink:href', function (d, i) { return "arcId_" + i; })
      .text(d => d.data.name);

    d3.select(self.frameElement).style("height", height + "px");
  }
  else {
    sunburstSvg.selectAll("*").remove();
    document.getElementById("labelId").style = "display:none";
  }

}

/*
@ Name - createGroupBarChart
@ Params - selectedEmployerList, originalMapData, groupBarSvg
@ Description - Creates Grouped Bar Chart comparing H1B petitions for the 
                years 2014, 2015 and 2016 for selected employers.
*/
function createGroupBarChart(selectedEmployerList, originalMapData, groupBarSvg) {
  /*If all bubbles are de-selected in the bubble chart then the grouped bar chart has to be
  removed entirely. So using length of the list to check if it is empty or not*/
  if (Array.isArray(selectedEmployerList) && selectedEmployerList.length) {
    groupBarSvg.selectAll("*").remove();
    var employerH1Petitions = {};
    var employerH1PetitionsList = [];
    /*Iterate through initial mapData and get the count of H1 petitions for each employer for all years*/
    originalMapData.forEach(function (data) {
      var key;
      key = data.EMPLOYER_NAME + data.YEAR;
      selectedEmployerList.forEach(function (selectedEmployer) {
        if (data.EMPLOYER_NAME == selectedEmployer) {
          if (!employerH1Petitions[key]) {
            employerH1Petitions[key] = { year: data.YEAR, h1Petitions: 0, employerName: data.EMPLOYER_NAME };
          }
          employerH1Petitions[key].h1Petitions++;
        }
      })
    });

    Object.keys(employerH1Petitions).forEach(function (key) {
      employerH1PetitionsList.push(employerH1Petitions[key]);
    });

    /*Above  list returns 3 rows for each employer for 3 years.
    Merge 3 records into one record by grouping it with each selected employer. */
    var newPetitionsSet = new Set(); //Using set to avoid duplicate rows.
    selectedEmployerList.forEach(selectedEmployer => {
      var empPerYearPetitions = new Object();
      employerH1PetitionsList.forEach(element => {
        if (element.employerName === selectedEmployer) {
          empPerYearPetitions[element.year] = element.h1Petitions;
          empPerYearPetitions["employerName"] = element.employerName;
        }
      });
      if (!empPerYearPetitions["2015"]) {
        empPerYearPetitions["2015"] = 0;
      }
      if (!empPerYearPetitions["2014"]) {
        empPerYearPetitions["2014"] = 0;
      }
      newPetitionsSet.add(empPerYearPetitions);
    });

    var lstEmpPerYearPetitions = [];
    lstEmpPerYearPetitions = Array.from(newPetitionsSet); //Converting set to list and use it to draw Grouped Bar Chart

    const margin = { top: 30, right: 0, bottom: 110, left: 30 },
      width = +groupBarSvg.attr("width") - margin.left - margin.right,
      height = +groupBarSvg.attr("height") - margin.top - margin.bottom;

    groupBarSvg = groupBarSvg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    var groupKey = "employerName";
    var keys = ["2014", "2015", "2016"];

    //Logic to create Grouped Bar chart
    x0 = d3.scaleBand()
      .domain(lstEmpPerYearPetitions.map(d => d[groupKey]))
      .rangeRound([margin.left, width - 250])
      .paddingInner(0.1);

    x1 = d3.scaleBand()
      .domain(keys)
      .rangeRound([0, x0.bandwidth()]);

    y = d3.scaleLinear()
      .domain([0, d3.max(lstEmpPerYearPetitions, d => d3.max(keys, key => d[key]))]).nice()
      .rangeRound([height - margin.bottom, margin.top]);

    xAxis = g => g
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x0).tickSizeOuter(0));

    yAxis = g => g
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickFormat(d3.format(".2s")));

    groupBarSvg.append("g")
      .selectAll("g")
      .data(lstEmpPerYearPetitions)
      .join("g")
      .attr("transform", d => `translate(${x0(d[groupKey])},0)`)
      .selectAll("rect")
      /*For the value of map : concatenate value as (H1 Petitions Count-Employer Name-year)
      which will be used in CreateBubbleChart method to fill the bars with sane color encoding as bubbles.*/
      .data(d => keys.map(key => ({ key, value: d[key] + '-' + d[groupKey] + '-' + key })))
      .join("rect")
      .attr("x", d => x1(d.key))
      .attr("y", d => y(d.value.split('-')[0]))
      .attr("width", x1.bandwidth())
      .attr("height", d => y(0) - y(d.value.split('-')[0]))
      .attr("stroke", "black")
      .attr("class", "bars")

    /* Logic to display year value for each bar. Create text similar to rectangles created above,
    and align the text position properly for each bar */
    groupBarSvg.append("g")
      .selectAll("g")
      .data(lstEmpPerYearPetitions)
      .join("g")
      .attr("transform", d => `translate(${x0(d[groupKey])},0)`)
      .selectAll("text")
      .data(d => keys.map(key => ({ key, value: d[key] })))
      .join("text")
      .attr("x", d => x1(d.key) + 15)
      .attr("y", (d) => y(d.value))
      /*Used some custom styling because, the grouped bar chart dynamically shrinks and adjust 
      to fit in the same space for any number of employers selected so adjust text properly */
      .attr("style", "writing-mode: vertical-lr;text-orientation: upright;text-anchor:end;font-size:12px;")
      .text(d => d.key);

    groupBarSvg.append("g")
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", "-.5em")
      .attr("transform", "rotate(-90)");

    groupBarSvg.append("g")
      .call(yAxis);

    groupBarSvg.append("text")
      .attr("class", "label")
      .attr("x", 10)
      .attr("y", 260)
      .attr("transform", "rotate(-90,-40," + (height / 2) + ")")
      .style("text-anchor", "center")
      .text("No of H1 Petitions");
  }
  else {
    groupBarSvg.selectAll("*").remove();
  }

}

/*
@ Name - getH1PetitionsCount
@ Params - selWorksite, selYear, H1Petitions_CountData
@ Description - Calculates the number of H1 petitions for each Worksite.
*/
function getH1PetitionsCount(selWorksite, selYear, H1Petitions_CountData) {
  var petitionsCount;
  H1Petitions_CountData.forEach(function (petitions) {
    if (petitions.worksite == selWorksite && petitions.year == selYear) {
      petitionsCount = petitions.count;
    }
  });
  return petitionsCount;
}

/*
@ Name - getTopEmployers
@ Params - mapData, selYear, topCount
@ Description - Calculates top 10 employers with more number of H1 petitions filed each year.
*/
function getTopEmployers(mapData, selYear, topCount) {
  var topEmployers = {};
  var topEmployersList = [];
  mapData.forEach(function (rows) {
    var topKey;
    if (selYear == 2014 || selYear == 2015 || selYear == 2016) {
      topKey = rows.EMPLOYER_NAME + rows.YEAR; //Key for selected year
    }
    else {
      topKey = rows.EMPLOYER_NAME; //Key for all the years
    }
    if (!topEmployers[topKey]) {
      topEmployers[topKey] = { year: rows.YEAR, worksite: rows.WORKSITE, petitionsCount: 0, employer: rows.EMPLOYER_NAME, wage: rows.PREVAILING_WAGE };
    }
    topEmployers[topKey].petitionsCount++;
  });

  Object.keys(topEmployers).forEach(function (key) {
    topEmployersList.push(topEmployers[key]);
  });

  var filterTopEmployers = topEmployersList;
  if (selYear == 2014 || selYear == 2015 || selYear == 2016) {
    topEmployersList = filterTopEmployers.filter(d => d.year == selYear);
  }
  else {
    topEmployersList = topEmployersList;
  }

  //Sort the data with respect to count of H1B petitions
  topEmployersList = topEmployersList.sort(function (a, b) {
    return b.petitionsCount - a.petitionsCount;
  });

  if (!topCount) {
    topCount = 10;
  }

  //Dynamically slice the data finally to get the top employers list
  topEmployersList = topEmployersList.slice(0, topCount);
  return topEmployersList;
}

/*
@ Name - createVis
@ Params - data
@ Description - Invoked on page load, used to invoke several other functions to create visualization.
*/
function createVis(data) {

  var width = 300;
  var height = 500;

  let mapData = data[0];
  let geoJsonData = data[1];

  var mapSvg = d3.select('#h1-petitions-map .map').append("svg")
    .classed("svg-container", true)
    .attr("width", 400)
    .attr("height", 500);

  var bubbleSvg = d3.select('#h1-petitions-map .bubble').append("svg")
    .classed("svg-container", true)
    .attr("width", 540)
    .attr("height", 500);

  var groupBarSvg = d3.select('#h1-petitions-map .groupBar').append("svg")
    .classed("svg-container", true)
    .attr("width", 600)
    .attr("height", 600);

  var sunburstSvg = d3.select('#h1-petitions-map .sunburstChart').append("svg")
    .classed("svg-container", true)
    .attr("width", 500)
    .attr("height", 500);

  var counts = {};
  var topEmployersFinalList = [];

  //Logic to calculate H1B petitions count for each worksite location
  mapData.forEach(function (rows) {
    var key = rows.WORKSITE + rows.YEAR;
    if (!counts[key]) {
      counts[key] = { year: rows.YEAR, worksite: rows.WORKSITE, count: 0 };
    }
    counts[key].count++;
  });

  topEmployersFinalList = getTopEmployers(mapData, '-All-', 10);

  var H1Petitions_CountData = [];
  Object.keys(counts).forEach(function (key) {
    H1Petitions_CountData.push(counts[key]);
  });

  //Logic for Year dropdown
  var dropdown = d3.select("#h1-petitions-map .controls")
    .insert("select", "svg")
    .attr("id","drpdownYear")
    .on("change", function () {
      var originalData = data[0];
      //Delete the Grouped bar chart and sunburst chart
      groupBarSvg.selectAll("*").remove();
      sunburstSvg.selectAll("*").remove();
      document.getElementById("labelId").style = "display:none";

      //Logic to get selected count of top employers list to be displayed
      var topCountListValue;
      var topCountId = document.getElementById("drpdownemp");
      if (topCountId) {
        topCountListValue = topCountId.options[topCountId.selectedIndex].value;
      }
      else{
        topCountListValue = 10;
      }

      var selectedYear = d3.select(this).property('value');
      mapData = originalData.filter(function (d) {
        if (selectedYear == '-All-') {
          return originalData;
        }
        else {
          return (d.YEAR == selectedYear);
        }
      });
      topEmployersFinalList = getTopEmployers(mapData, selectedYear, topCountListValue);
      createIllinoisMap(geoJsonData, mapData, originalData, mapSvg, bubbleSvg, groupBarSvg,
        sunburstSvg, H1Petitions_CountData, topEmployersFinalList, width, height);
    });

  dropdown.selectAll("option")
    .data(['-All-', 2014, 2015, 2016])
    .enter().append("option")
    .attr("value", function (d) { return d; })
    .text(function (d) {
      return d;
    });

  //Logic for top employers list dropdown
  var topDropdown = d3.select("#h1-petitions-map .top-controls")
    .insert("select", "svg")
    .attr("id","drpdownemp")
    .on("change", function () {
      var selectedTopCount = d3.select(this).property('value');
      //Delete the Grouped bar chart and sunburst chart
      groupBarSvg.selectAll("*").remove();
      sunburstSvg.selectAll("*").remove();
      document.getElementById("labelId").style = "display:none";

      //Logic to get selected year to be displayed to ensure the value is not lost.
      var yearListValue;
      var yearId = document.getElementById("drpdownYear");
      if (yearId) {
        yearListValue = yearId.options[yearId.selectedIndex].value;
      }
      else{
        yearListValue = '-All-';
      }

      var originalData = data[0];
      topEmployersFinalList = getTopEmployers(mapData, yearListValue, selectedTopCount);
      createIllinoisMap(geoJsonData, mapData, originalData, mapSvg, bubbleSvg, groupBarSvg,
        sunburstSvg, H1Petitions_CountData, topEmployersFinalList, width, height);
    });

  topDropdown.selectAll("option")  
    .data([10, 15, 20])
    .enter().append("option")
    .attr("value", function (d) { return d; })
    .text(function (d) {
      return d;
    });

  createIllinoisMap(geoJsonData, mapData, mapData, mapSvg, bubbleSvg, groupBarSvg,
    sunburstSvg, H1Petitions_CountData, topEmployersFinalList, width, height);

}
Promise.all([
  d3.csv("https://raw.githubusercontent.com/swathikonatham/DataVisualizationProject/master/Illinios-H1_Petitions.csv"),
  d3.json("https://gist.githubusercontent.com/dakoop/2d6f78f5bbe75c0cea60cd7dfec3bb39/raw/dbb35c139c5147e14b2971835948d0af8362ed68/il-counties.geojson")
]).then(createVis);

