$(document).ready(function(){
  if($("#senate_viz").length){
    // helper function
    var hasObjectWithName = function(arr, name){
        var record = _.findWhere(arr, {name: name});
        return (typeof record === 'undefined')? false : true;
    };

    // Code to organize the contributinos data to the desired format
    contributionData = {
      name: 'Contributions',
      tooltipLevel: "contributions",
      children: [],

      hasCycle: function(year){
        return hasObjectWithName(this.children, year);
      },

      cycle: function(year){
        return _.findWhere(this.children, {name: year});
      },

      addCycle: function(d){
        this.children.push({
          name: d.cycle, children: [], tooltipLevel: "cycle",
          candidateCount: function(){
            return this.children.length;
          },
          candidateAverage: function(){
            return this.value / this.candidateCount();
          }
        });
        this.addPolitician(d);
      },

      hasPolitician: function(cycle, name){
        return hasObjectWithName(this.cycle(cycle).children, name);
      },

      politician: function(cycle, name){
        return _.findWhere(this.cycle(cycle).children, {name: name});
      },

      addPolitician: function(d){
        var polAttributes = {
          name: d.politician_name, party: d.party, cid: d.politician_cid,
          district: d.district_run_for, children: [], tooltipLevel: "politician",
          state: d.district_run_for.substring(0,2), displayName: d.politician_name.slice(0, -4),
          pacTotal: function(){
            var that = this;
            return _.reduce(that.children, function(sum, num){ return num.moneySource == "pac" ? sum + num.value : sum; }, 0);
          },
          pacPercentage: function(){
            var pacTotal = this.pacTotal();
            return pacTotal / this.value;
          }
        };
        this.cycle(d.cycle).children.push(polAttributes);
        this.addIndustryContribution(d);
      },

      addIndustryContribution: function(d){
        var industryAttributes = {
          name: d.sector, moneySource: d.money_source,
          size: parseInt(d.amount_raised, 10), tooltipLevel: "contribution",
          percentOfTotal: function(){
            return this.value / this.parent.value;
          }
        };
        this.politician(d.cycle, d.politician_name).children.push(industryAttributes);
      },

      addRecord: function(d){
        if(!this.hasCycle(d.cycle)){
          this.addCycle(d);
        } else if(!this.hasPolitician(d.cycle, d.politician_name)){
          this.addPolitician(d);
        } else {
          this.addIndustryContribution(d);
        }
      },

      populate: function(results){
        var that = this;
        _.each(results, function(d){
          that.addRecord(d);
        });
      }
    };

    // Code for visualization
    var diameter = window.innerWidth * (4/10),
        padding = 4,
        x = d3.scale.linear().range([0, diameter]),
        y = d3.scale.linear().range([0, diameter]);

   showTooltips = false;

    var pack = d3.layout.pack()
      .sort(function(a, b){ return a.size > b.size ? a : b; })
      .size([diameter - padding, diameter - padding])
      .padding(0)
      .value(function(d){ return (typeof d.size === 'undefined' || d.size < 0) ? 0 : d.size; });


    var tooltip = d3.select("body").append("div")
      .attr("class", "vizTooltip")
      .text("");

    var dollarFormat = d3.format("$,.0f");
    var percentFormat = d3.format(".2p");

    var message = function(d){
      if(d.tooltipLevel == 'cycle'){
        return cycleMessage(d);
      } else if(d.tooltipLevel == 'politician') {
        return politicianMessage(d);
      } else if(d.tooltipLevel == 'contribution'){
        return contributionMessage(d);
      }
    };

    var cycleMessage = function(d){
      var message = "";
      message += "<span>Election Cycle - " + d.name + "</span>";
      message += "<span>";
      message += "Total Raised: " + dollarFormat(d.value) + "</span>";
      message += "<span>";
      message += "Number of Candidates: " + d.candidateCount() + "</span>";
      message += "<span>";
      message += "Average Per Candidate: " + dollarFormat(d.candidateAverage()) + "</span>";
      return message;
    };

    var politicianMessage = function(d){
      var message = "";
      message += "<div class='politicianMessage'>"
      var party = d.party === "D" ? "democrat" : "republican";
      message += "<div class='name " + party + "'>" + d.displayName + "</div>";
      message += "<div class='party_state'>" + d.party + " - " + d.state + "</div>";
      message += "<div class='details'> Total Raised: " + dollarFormat(d.value);
      message += "<br/>";
      message += "% From Individuals: " + percentFormat(1 - d.pacPercentage());
      message += "<br/>";
      message += "% From Pacs: " + percentFormat(d.pacPercentage());
      message += "</div>";
      message += "</div>";
      return message;
    };

    var contributionMessage = function(d){
      var message = "";
      message += "<h3>" + d.name + "</h3>";
      message += "<br/>";
      message += "Total Raised: " + dollarFormat(d.value);
      message += "<br/>";
      message += "% of Total Raised: " + percentFormat(d.percentOfTotal());
      return message;
    };

    var tooltipMessage = function(d){
      return message(d);
    };


    d3.json("public/senate.json", function(error, senate_data){
      nope = root = contributionData.populate(senate_data.result);
      sdata = senate_data;

      // create circles

      pack(contributionData);
      var cycleTotals = _.map(contributionData.children, function(d){ return d.value;});
      var cycleSize = d3.scale.linear()
        .range([20, 50])
        .domain([_.min(cycleTotals), _.max(cycleTotals)]);

      var setActive = function(year){
        activeYear = year;
        $('#years .active').removeClass('active');
        $("#years .year_" + year).addClass('active');
      };

      var sortedYears = _.sortBy(contributionData.children, function(d){ return parseInt(d.name, 10); });
      console.log(sortedYears);

      var yearSvg = d3.select(".years_container").selectAll("svg")
          .data(sortedYears)
        .enter()
          .append("div")
            .attr("class", function(d){ return "year year_" + d.name; })
          .append("svg")
            .attr("width", function(d){ return cycleSize(d.value) * 2 + 20; })
            .attr("height", 100);

      yearSvg.append("text")
        .attr("x", function(d){ return cycleSize(d.value) + 10; })
        .attr("y", 55)
        .style("text-anchor", "middle")
        .text(function(d){ return d.name; });

      yearSvg.append("g")
        .append("circle")
          .attr("transform", function(d){ return "translate(" + (cycleSize(d.value) + 10) +",50)"; })
          .attr("r", function(d){ return cycleSize(d.value);})
          .on("mouseover", function(d){
            $('.cycle_message').html(cycleMessage(d));
          })
          .on("click", function(d){
            setActive(d.name);
            displayYear(parseInt(d.name, 10));
          });

      displayYear = function(year){
        $("#candidates").html("");
        cycleCandidates = _.find(contributionData.children, function(d){ return parseInt(d.name, 10) === year; });
        sortedCandidates = _.sortBy(cycleCandidates.children, function(d){ return d.value; }).reverse();
        candidateContainer = d3.select("#candidates").selectAll(".candidate")
            .data(sortedCandidates);

        candidateContainer.enter().append("div")
            .attr("width", 200)
            .attr("height", 200)
            .attr("class", function(d){ return "candidate " + d.name; })
            .on("click", function(d){
              console.log(d.name);
            });

        candidateContainer.append("div")
          .attr("class", "sub_cand cand_message")
          .html(function(d){ return politicianMessage(d);});

        csvgs = candidateContainer
          .append("div")
            .attr("class", "sub_cand circle_pack")
          .append("svg")
            .attr("width", 200)
            .attr("height", 200);

        cviz = csvgs.append("g");

        var polTotals = _.map(sortedCandidates, function(d){ return d.value;});
        polSize = d3.scale.pow()
          .exponent(0.5)
          .range([20, 200])
          .domain([500000,50000000]);
          //.domain([_.min(polTotals), _.max(polTotals)]);

        candPack = d3.layout.pack()
          .sort(function(a, b){ return a.size > b.size ? a : b; })
          .size([90, 90])
          .padding(0)
          .value(function(d){ return (typeof d.size === 'undefined' || d.size < 0) ? 0 : d.size; });

        packPols = function(d){
          var s = polSize(d.value);
          candPack.size([s,s]);
          return candPack.nodes(d);
        };

        drawCircles = function(d){
          var g = d3.select(this);

          // Centers the candidate circles
          var centerOffset = function(d){
            var offset = 100 - d.r;
            g.attr("transform", "translate(" + offset + "," + offset + ")");
          };

          var node = g.datum(d).selectAll(".node")
            .data(packPols)
          .enter().append("g")
            .attr("class", function(d){
              if(d.children){
                return "node";
              } else {
                return d.moneySource == "pac" ? "pac leaf node" : "individual leaf node";
              }
            })
            .attr("transform", function(d) {
              if(d.children){
                centerOffset(d);
                return "translate(" + d.x + "," + d.y + ")";
              } else {
                return "translate(" + d.x + "," + d.y + ")";
              }
            });


          node.append("circle")
            .attr("r", function(d){ return d.r; })
            .attr("class", function(d){ return d.children ? "parent" : "child"; })
            .on("mouseover", function(d){
              if(showTooltips && d.tooltipLevel == "contribution"){
                tooltip.html(tooltipMessage(d));
                tooltip.style("visibility", "visible");
              }
              return;
            })
            .on("mousemove", function(){
              return tooltip.style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 20) + "px");
            })
            .on("mouseout", function(){
              tooltip.style("visibility", "hidden");
              return;
            })
        };

        cviz.each(drawCircles);


      };

      showDetail = function(d){
      };
    });





  }
});
