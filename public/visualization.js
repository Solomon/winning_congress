$(document).ready(function(){
  if($("#senate_viz").length){
    // helper function
    var hasObjectWithName = function(arr, name){
        var record = _.findWhere(arr, {name: name});
        return (typeof record === 'undefined')? false : true;
    };

    sectorMappings = { 1: " Agribusiness", 2: " Communic/Electronics", 3: " Construction", 4: " Defense", 5: " Energy/Nat Resource", 6: " Finance/Insur/RealEst", 7: " Health", 8: " Ideology/Single-Issue", 9: " Labor", 10: " Lawyers & Lobbyists", 11: " Misc Business", 12: " Non-contribution", 13: " Other", 14: " Party Cmte", 15: " Transportation", 16: " Unknown", 17: " Candidate", 18: " Joint Candidate Cmtes" };

    // Code to organize the contributinos data to the desired format
    createContributions = function(branch, data){
      var contributionObject = {
        name: 'Contributions',
        tooltipLevel: "contributions",
        branch: branch,
        // Add senate & house children here
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

        politicianFromUrl: function(cycle, url_name){
          return _.findWhere(this.cycle(cycle).children, {urlName: url_name});
        },

        addPolitician: function(d){
          var polAttributes = {
            name: d.politician_name, party: d.politician_name.slice(-2,-1),
            district: d.district_run_for, children: [], tooltipLevel: "politician",
            state: d.district_run_for.substring(0,2), displayName: d.politician_name.slice(0, -4),
            urlName: d.politician_name.slice(0, -4).toLowerCase().replace(/\ /g, "_"),
            pacTotal: function(){
              var that = this;
              return _.reduce(that.children, function(sum, num){ return num.moneySource == "p" ? sum + num.value : sum; }, 0);
            },
            individualTotal: function(){
              var pacTotal = this.pacTotal();
              return this.value - pacTotal;
            },
            pacPercentage: function(){
              var pacTotal = this.pacTotal();
              return pacTotal / this.value;
            },
            pacContributions: function(){
              var that = this;
              return _.where(that.children, {moneySource: "p"});
            },
            individualContributions: function(){
              var that = this;
              return _.where(that.children, {moneySource: "i"});
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

        populate: function(branch, results){
          var that = this;
          _.each(results, function(d){
            if(d.house == branch.charAt(0)){
              that.addRecord(d);
            }
          });
        }
      };
      contributionObject.populate(branch, data);
      return contributionObject;
    };

    // Code for visualization
    var diameter = window.innerWidth * (4/10),
        padding = 4;

    showTooltips = true;

    var pack = d3.layout.pack()
      .sort(function(a, b){ return a.size > b.size ? a : b; })
      .size([diameter - padding, diameter - padding])
      .padding(0)
      .value(function(d){ return (typeof d.size === 'undefined' || d.size < 0) ? 0 : d.size; });


    var tooltip = d3.select("body").append("div")
      .attr("class", "vizTooltip")
      .style("position", "absolute")
      .style("z-index", "10000")
      .style("visibility", "hidden")
      .text("Winning Congress");

    var dollarFormat = d3.format("$,.0f");
    var percentFormat = d3.format(".2p");
    var partyName = d3.scale.ordinal().domain(["D","R","I"]).range(["democrat", "republican", "independent"]);

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
      message += "<span><strong>Election Cycle</strong> - " + d.name + "</span>";
      message += "<span>";
      message += "<strong>Total Raised</strong> - " + dollarFormat(d.value) + "</span>";
      message += "<span>";
      message += "<strong>Number of Candidates</strong> - " + d.candidateCount() + "</span>";
      message += "<span><strong>";
      message += "Average Per Candidate</strong> - " + dollarFormat(d.candidateAverage()) + "</span>";
      return message;
    };

    var politicianMessage = function(d){
      var message = "";
      message += "<div class='politicianMessage'>"
      message += "<div class='name " + partyName(d.party) + "'>" + d.displayName + "</div>";
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
      message += d.moneySource == "p" ? "Pac" : "Individual";
      message += "<br/>";
      message += "Total Raised: " + dollarFormat(d.value);
      message += "<br/>";
      message += "% of Total Raised: " + percentFormat(d.percentOfTotal());
      return message;
    };

    var tooltipMessage = function(d){
      return message(d);
    };

    var loadAreaLightbox= function(d){
      $.fancybox({
        'scrolling': 'no',
        'AutoDimension': true,
        'margin': [20,0,10,0],
        'fitToView': false,
        'maxWidth': "95%",
        'padding': 0,
        content:
          '<div id="candidate_detailed_view"">' +
            '<div class="candAttributes topRow">' +
              '<h2 class="chart_title">'  + d.name + '</h2>' +
              '<h4 class="chart_title">' + d.parent.name + ' - ' + d.state + '</h2>' +
              '<h4 class="chart_title">Total Raised From Individuals: ' + dollarFormat(d.individualTotal()) + '</h2>' +
              '<h4 class="chart_title">Total Raised From Pacs: ' + dollarFormat(d.pacTotal()) + '</h2>' +
              '<h4 class="chart_title">Percent From Individuals: ' + percentFormat(1-d.pacPercentage()) + '</h2>' +
              '<h4 class="chart_title">Percent From Pacs: ' + percentFormat(d.pacPercentage()) + '</h2>' +
            '</div>' +
            '<div class="bigIndividualCircle topRow">' +
              '<div class="candLegend"></div>' +
            '</div>' +
            '<div class="clear"></div>' +
            '<div class="contributionContainer">' +
              '<h3>Contributions From Individuals</h3>' +
              '<div class="indContributions"></div>' +
            '</div>' +
            '<div class="contributionContainer">' +
              '<h3>Contributions From Pacs</h3>' +
              '<div class="pacContributions"></div>' +
            '</div>' +
          '</div>',
        'afterClose': removeCandidate
      });
    };

    drawCircles = function(d){
      var g = d3.select(this);

      // Set the timeout so candidate list can load without the
      // browser getting hung up until all the candidate circles
      // can render
      setTimeout(function(){

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
              return d.moneySource == "p" ? "pac leaf node" : "individual leaf node";
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
      },100);
    };

    var createYearlyCircles = function(){
      $('.years_container').html('');
      pack(contributionData);

      var sortedYears = _.sortBy(contributionData.children, function(d){ return parseInt(d.name, 10); });

      // Drop House 2014 cycle
      var sortedYears = _.filter(sortedYears, function(d){ return d.name != '2014'; });

      var cycleTotals = _.map(sortedYears, function(d){ return d.value;});

      // Change range for house vs. senate
      var cycleRange = contributionData.branch == 'senate' ? [20,50] : [20,50];
      var cycleSize = d3.scale.linear()
        .range(cycleRange)
        .domain([_.min(cycleTotals), _.max(cycleTotals)]);


      var yearSvg = d3.select(".years_container").selectAll("svg")
          .data(sortedYears)
        .enter()
          .append("div")
            .attr("class", function(d){ return "year year_" + d.name; })
          .append("svg")
            .attr("width", function(d){ return cycleSize(d.value) * 2 + 20; })
            .attr("height", 104);

      yearSvg.append("text")
        .attr("x", function(d){ return cycleSize(d.value) + 10; })
        .attr("y", 56)
        .style("text-anchor", "middle")
        .text(function(d){ return d.name; });

      yearSvg.append("g")
        .append("circle")
          .attr("transform", function(d){ return "translate(" + (cycleSize(d.value) + 10) +",52)"; })
          .attr("r", function(d){ return cycleSize(d.value);})
          .attr("class", "year_circle")
          .on("mouseover", function(d){
            //$('.cycle_message').html(cycleMessage(d));
          })
          .on("click", function(d){
            $('.cycle_message').html(cycleMessage(d));
            appRouter.navigate(contributionData.branch + "/year/" + d.name, {trigger: true});
          });
    };

    // Changes which selector (house or senate) is highlighted as active
    var setActiveBranch = function(){
      var dataBranch = contributionData.branch;
      var selectedBranch = $('.select_branch .active').text();
      if(dataBranch != selectedBranch){
        $('.select_branch .active').removeClass('active');
        $('.select_branch .' + dataBranch).addClass('active');
      }
    };

    var setActiveYear = function(year){
      activeYear = year;
      $('.cycle_message').html(cycleMessage(contributionData.cycle(year)));
      $('#years .active').removeClass('active');
      $("#years .year_" + year).addClass('active');
    };

    var displayYear = function(year){
      if(typeof activeYear !== 'undefined' && activeYear == year){ return; }

      setActiveYear(year);
      setActiveBranch();
      $("#candidates").html("");
      var cycleCandidates = _.find(contributionData.children, function(d){ return d.name === year; });
      var sortedCandidates = _.sortBy(cycleCandidates.children, function(d){ return d.value; }).reverse();
      var candidateContainer = d3.select("#candidates").selectAll(".candidate")
          .data(sortedCandidates);

      candidateContainer.enter().append("div")
          .attr("width", 200)
          .attr("height", 200)
          .attr("class", function(d){ return "candidate " + d.name; })
          .on("click", function(d){
            appRouter.navigate(contributionData.branch + '/year/' + year + '/candidate/' + d.urlName, {trigger: true});
          });

      candidateContainer.append("div")
        .attr("class", "sub_cand cand_message")
        .html(function(d){ return politicianMessage(d);});

      var csvgs = candidateContainer
        .append("div")
          .attr("class", "sub_cand circle_pack")
        .append("svg")
          .attr("width", 200)
          .attr("height", 200);

      var cviz = csvgs.append("g");

      var domain = contributionData.branch == 'house' ? [300000, 16000000] : [500000, 50000000];

      var polTotals = _.map(sortedCandidates, function(d){ return d.value;});
      var polSize = d3.scale.pow()
        .exponent(0.5)
        .range([20, 200])
        .domain(domain);

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

      cviz.each(drawCircles);

      $('.credits').removeClass('hidden');

      createLegend('.legend');
      //$('.mailing_list').removeClass('hidden');
    };


    var contributionTable = function(c){
      var sorted = _.sortBy(c, function(n){ return n.size * -1; });
      var total = _.reduce(sorted, function(sum, num){ return sum + num.size; }, 0);
      var t = "";
      t += "<table class='contribution_table'><tr><td>Industry</td><td>Amount</td><td></td></tr>";
      _.each(sorted, function(d){
        t += "<tr><td>" + d.name + "</td><td>" + dollarFormat(d.size) + "</td><td>" + percentFormat(d.size / total) + "</td></tr>";
      });
      t += "<tr><td><strong>Total</strong></td><td><strong>" + dollarFormat(total) + "</strong></td></tr>";
      t += "</table>";
      return t;
    };


    createLegend = function(selector){
      if($(selector).html().length){ return;}

      var info = [
        {'name': 'Pac Contribution', 'color': '#8c510a'},
        {'name': 'Individual Contribution', 'color': '#5ab4ac'}
      ];

      var legendScale = d3.scale.ordinal()
        .domain(['Individual Contribution', 'Pac Contribution'])
        .range([0,250]);

      var legendContainer = d3.select(selector)
        .append("svg")
          .attr("width", 550)
          .attr("height", 30);

      var legendGroup = legendContainer.selectAll('legendGroup')
        .data(info)
        .enter()

      legendGroup.append("g")
        .append("rect")
          .attr("width", 50)
          .attr("height", 20)
          .attr("transform", function(d){ return "translate(" + legendScale(d.name) + ", 10)";  })
          .style("fill", function(d){ return d.color; });

      legendGroup.append("text")
        .text(function(d){ return d.name; })
        .attr("transform", function(d){ return "translate(" + (legendScale(d.name) + 60) + ", 0)";  })
        .attr('height',50)
        .attr('y', 25)
        .style('fill', 'black');
    };

    var loadDetailCircle = function(d){
      packPols(d);

      var detailContainer = d3.select(".bigIndividualCircle")
        .append("svg")
          .attr("width", 320)
          .attr("height", 320)
        .append("g")
          .attr("class", "hiddenOG");

      candPack.size([300,300])

      var node = detailContainer.datum(d).selectAll(".node")
        .data(candPack)
      .enter().append("g")
        .attr("class", function(d){
          if(d.children){
            return "node";
          } else {
            return d.moneySource == "p" ? "pac leaf node" : "individual leaf node";
          }
        })
        .attr("transform", function(d) {
          if(d.children){
            return "translate(" + d.x + "," + d.y + ")";
          } else {
            return "translate(" + d.x + "," + d.y + ")";
          }
        });

      node.append("circle")
        .attr("r", function(d){ return d.r; })
        .attr("class", function(d){ return d.children ? "parent" : "child"; })
        .on("mouseover", function(d){
          if(d.tooltipLevel == 'contribution'){
            tooltip.html(tooltipMessage(d));
            return tooltip.style("visibility", "visible");
          }
        })
        .on("mousemove", function(){
          var top = d3.event.pageY;
          var left = d3.event.pageX;
          return tooltip.style("top", (top - 10) + "px").style("left", (left + 20) + "px");
        })
        .on("mouseout", function(){
          return tooltip.style("visibility", "hidden");
        })
    };

    var showDetail = function(d){
      loadAreaLightbox(d);
      $('.indContributions').html(contributionTable(d.individualContributions()));
      $('.pacContributions').html(contributionTable(d.pacContributions()));
      createLegend('.candLegend');
      loadDetailCircle(d);
    };

    var CongressRouter = Backbone.Router.extend({
      routes: {
        '': "home",
        ':branch/year/:year' : 'year',
        ':branch/year/:year/candidate/:candidate': 'candidate'
      },

      home: function(){
      },

      year: function(branch, year){
        setBranch(branch);
        displayYear(year);
      },

      candidate: function(branch, year, candidate){
        setBranch(branch);
        displayYear(year);
        var cand = contributionData.politicianFromUrl(year, candidate);
        showDetail(cand);
      }
    });

    setBranch = function(branch){
      if(branch == contributionData.branch){ return;}

      if(branch == 'senate'){
        contributionData = senate;
      } else {
        contributionData = house;
      }
      createYearlyCircles();
    };

    switchBranch = function(branch){
      var currentUrl = document.URL.split('#')[1];
      activeYear = 1;
      if(currentUrl){
        var newUrl = branch == 'house' ? currentUrl.replace('senate','house') : currentUrl.replace('house', 'senate');
        appRouter.navigate(newUrl, {trigger: true});
      } else {
        setBranch(branch);
      }
    };

    removeCandidate = function(){
      var urlParams = document.URL.split('#')[1].split('/');
      if(urlParams.length == 5){
        var newParams = urlParams.slice(0,3).join('/');
        appRouter.navigate(newParams, {trigger: true});
      }
    };

    // Switch branch when user clicks
    $('.select_branch li').on("click", function(){
      var branch = $(this).text().toLowerCase();
      switchBranch(branch);
    });


    //d3.csv("public/smallest_senate_only.csv", function(error, congress){
    //d3.csv("public/smaller_pols.csv", function(error, congress){
    d3.csv("https://solomon_projects.s3.amazonaws.com/winningcongress/compressed_pols.csv", function(error, congress){
      senate = createContributions('senate', congress);
      house = createContributions('house', congress);
      contributionData = senate;
      createYearlyCircles();

      appRouter = new CongressRouter();
      Backbone.history.start();
    });

  }
});
