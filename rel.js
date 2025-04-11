require([
  "esri/WebMap",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/layers/GraphicsLayer",
  "esri/widgets/Expand",
  "esri/widgets/Legend",
  "esri/core/reactiveUtils",
  "esri/widgets/BasemapToggle",
  "esri/widgets/Search",
  "esri/widgets/LayerList",
  "esri/Graphic",
  "esri/identity/OAuthInfo",
  "esri/identity/IdentityManager",
  "esri/portal/Portal",
  "esri/widgets/Print"
], function(
  WebMap, 
  MapView, 
  FeatureLayer, 
  GraphicsLayer, 
  Expand, 
  Legend, 
  reactiveUtils, 
  BasemapToggle, 
  Search, 
  LayerList, 
  Graphic,
  OAuthInfo, 
  IdentityManager, 
  Portal,
  Print
) {

  // Safely determine if running in Electron or browser
  const isElectron = window && window.process && window.process.type;
  console.log("Running in environment:", isElectron ? "Electron" : "Browser");

  // Show the welcome modal on launch
  const welcomeModal = document.getElementById("welcomeModal");
  const startButton = document.getElementById("startButton");

  // Get base URL for OAuth callback
  let callbackUrl;
  try {
    // Handle various ways the app might be hosted
    const baseUrl = window.location.href.split('#')[0].split('?')[0];
    const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
    callbackUrl = new URL("oauth-callback.html", basePath).href;
    console.log("Calculated callback URL:", callbackUrl);
  } catch (e) {
    console.error("Error calculating OAuth callback URL:", e);
    callbackUrl = window.location.origin + "/oauth-callback.html";
  }

  // Initialize OAuth info with more robust URL handling
  const info = new OAuthInfo({
    appId: "pPrg9fAk5JOQBCuq",
    portalUrl: "https://sce2.maps.arcgis.com",
    popup: false,
    popupCallbackUrl: callbackUrl,
    preserveUrlHash: true,
    flowType: "implicit", // Use implicit flow for simpler authentication
    expires: 20160 // 2 weeks
  });

  // Log the OAuth callback URL for debugging
  console.log("OAuth callback URL:", info.popupCallbackUrl);
  
  // Register the authentication details
  IdentityManager.registerOAuthInfos([info]);
  
  // Handle authentication error with more detailed logging
  IdentityManager.on("error", (error) => {
    console.error("Authentication error:", error);
    // Show more details about the error for debugging
    if (error && error.message) {
      document.getElementById("userMessage").innerText = "Auth Error: " + error.message;
    }
  });

  // Adjust modal behavior to replace login button functionality
  if (welcomeModal && startButton) {
    IdentityManager.checkSignInStatus(info.portalUrl + "/sharing/rest")
      .then((credential) => {
        welcomeModal.style.display = "none";
        document.getElementById("userMessage").innerText = `Welcome, ${credential.userId}`;
        loadMap();
      })
      .catch(() => {
        welcomeModal.style.display = "flex";
        startButton.addEventListener("click", () => {
          IdentityManager.getCredential(info.portalUrl + "/sharing/rest")
            .then(() => {
              welcomeModal.style.display = "none";
              loadMap();
            });
        });
      });
  }

  // Automatically execute login functionality if the user is not logged in
  IdentityManager.checkSignInStatus(info.portalUrl + "/sharing/rest")
    .then((credential) => {
      loadMap();
    })
    .catch(() => {
      IdentityManager.getCredential(info.portalUrl + "/sharing/rest")
        .then(() => {
          loadMap();
        });
    });

  function loadMap() {
    const webmap = new WebMap({
      portalItem: {
        id: "ca1b6e04830d492a8e8a8628d77c63c5" // web map ID
      }
    });

    const view = new MapView({
      container: "viewDiv",
      map: webmap
    });

    // Global filter state
    let globalFilter = {
      // Geographic filters
      county: null, 
      city: null,
      // Organizational filters
      region: null,
      district: null,
      substation: null
    };
    
    // Specify which layers should be filtered (opt-in approach)
    const layersToFilter = {
      "cMAIFI": true,
      "cSAIFI": true,
      "cSAIDI": true,
      "Outages": true,
      "CAIDI": true,
      "MAIFI": true,
      "SAIFI": true,
      "SAIDI": true,
      "Reliability_Dissolve_Lines": true
    };

    // Helper function to determine if a layer should be filtered
    function shouldFilterLayer(layer) {
      // Don't filter layers with "County" or "District" in their title
      if (layer.title && (
          layer.title.toLowerCase().includes("county") || 
          layer.title.toLowerCase().includes("district") ||
          layer.title.toLowerCase().includes("counties") || 
          layer.title.toLowerCase().includes("districts"))) {
        return false;
      }
      
      // If we have specific layers to filter, check if this layer is in the list
      if (Object.keys(layersToFilter).length > 0) {
        return layersToFilter[layer.title] === true || layersToFilter[layer.id] === true;
      }
      
      // Default: filter all other feature layers
      return layer.type === "feature";
    }

    // When the web map is loaded, access its layers for filtering
    view.when(() => {
      console.log("Web map loaded successfully");
      
      // Make sure webmap is fully loaded before proceeding
      webmap.when(() => {
        console.log("WebMap fully loaded");
        
        // Initialize line renderer with SAIDI colors
        const metricGroupLayer = webmap.allLayers.find(layer => 
          layer.title === "Reliability Metrics 2025"
        );

        if (metricGroupLayer) {
          metricGroupLayer.when(() => {
            const saidiLayer = metricGroupLayer.layers?.find(layer => 
              layer.title === "SAIDI"
            );
            if (saidiLayer) {
              saidiLayer.when(() => {
                updateLineRenderer(view, "SAIDI");
              });
            }
          });
        }

        // Get all operational layers from the webmap
        const allLayers = webmap.allLayers;
        
        // Store filterable layers
        const featureLayers = allLayers.filter(layer => {
          return layer.type === "feature";
        });
        
        if (featureLayers.length > 0) {
          console.log(`Found ${featureLayers.length} feature layers`);
          
          // Log details about each layer to help with debugging
          featureLayers.forEach((layer, index) => {
            console.log(`Layer ${index}: Title=${layer.title}, ID=${layer.id}, Type=${layer.type}, Filterable=${shouldFilterLayer(layer)}, LoadStatus=${layer.loaded ? 'Loaded' : 'Not loaded'}`);
            if (layer.fields) {
              console.log(`Fields for layer ${index}:`, layer.fields.map(f => f.name).join(', '));
            }
            
            // Auto-populate layers to filter based on field existence
            if (layer.fields) {
              const hasFilterFields = layer.fields.some(f => 
                f.name === "COUNTY" || f.name === "CITY" || f.name === "SUBSTATION"
              );
              if (hasFilterFields && shouldFilterLayer(layer)) {
                layersToFilter[layer.title] = true;
                console.log(`Auto-added ${layer.title} to filterable layers list`);
              }
            }
          });
          
          // Wait for all feature layers to load before setting up UI
          Promise.all(featureLayers.map(layer => {
            return layer.load().catch(error => {
              console.warn(`Failed to load layer "${layer.title}": ${error.message}`);
              return layer; // Return layer anyway to continue with other layers
            });
          })).then(() => {
            console.log("All feature layers loaded or attempted to load");
            
            // Find a suitable layer for filtering (one with the required fields)
            const filterLayer = findSuitableFilterLayer(featureLayers);
            
            if (filterLayer) {
              console.log(`Using layer "${filterLayer.title}" for filtering`);
              setupUIWidgets(view, featureLayers, filterLayer);
            } else {
              console.warn("No suitable layer found for filtering");
              setupUIWidgets(view, featureLayers, null);
            }
          })
          .catch(error => {
            console.error("Error loading feature layers:", error);
            // Still set up basic UI without filtering
            setupUIWidgets(view, featureLayers, null);
          });
        } else {
          console.warn("No feature layers found in the web map");
          // Still set up basic UI without filtering
          setupUIWidgets(view, [], null);
        }
      });
    }).catch(error => {
      console.error("Error loading web map:", error);
    });
    
    // Find a layer suitable for filtering (has required fields)
    function findSuitableFilterLayer(layers) {
      // First, try to find layers with specific names that might contain complete data
      const preferredLayerNames = ["equipment", "devices", "locations", "features", "assets"];
      for (const name of preferredLayerNames) {
        for (const layer of layers) {
          if (!layer.fields) continue;
          
          const fieldNames = layer.fields.map(f => f.name);
          if (layer.title && layer.title.toLowerCase().includes(name) &&
              fieldNames.includes("COUNTY") && 
              fieldNames.includes("CITY") && 
              fieldNames.includes("SUBSTATION")) {
            console.log(`Found preferred layer with all fields: "${layer.title}"`);
            return layer;
          }
        }
      }
      
      // First, look for a layer that has all three fields
      for (const layer of layers) {
        if (!layer.fields) continue;
        
        const fieldNames = layer.fields.map(f => f.name);
        if (fieldNames.includes("COUNTY") && 
            fieldNames.includes("CITY") && 
            fieldNames.includes("SUBSTATION")) {
          console.log(`Found ideal layer with all fields: "${layer.title}"`);
          return layer;
        }
      }
      
      // If no ideal layer found, look for one with at least county and city
      for (const layer of layers) {
        if (!layer.fields) continue;
        
        const fieldNames = layer.fields.map(f => f.name);
        if (fieldNames.includes("COUNTY") && fieldNames.includes("CITY")) {
          console.log(`Found partial layer with county and city: "${layer.title}"`);
          return layer;
        }
      }
      
      // If still nothing, return the first layer that has at least one of the fields
      for (const layer of layers) {
        if (!layer.fields) continue;
        
        const fieldNames = layer.fields.map(f => f.name);
        if (fieldNames.includes("COUNTY") || 
            fieldNames.includes("CITY") || 
            fieldNames.includes("SUBSTATION")) {
          console.log(`Found basic layer with at least one field: "${layer.title}"`);
          return layer;
        }
      }
      
      // If we got here, no suitable layer was found
      return null;
    }
    
    // Apply global filter to all applicable feature layers
    function applyGlobalFilter(layers) {
      const expressions = [];
      if (globalFilter.district) expressions.push(`DISTRICT = '${globalFilter.district}'`);
      if (globalFilter.county) expressions.push(`COUNTY = '${globalFilter.county}'`);
      if (globalFilter.city) expressions.push(`CITY = '${globalFilter.city}'`);
      if (globalFilter.substation) expressions.push(`SUBSTATION = '${globalFilter.substation}'`);
      if (globalFilter.region) expressions.push(`REGION = '${globalFilter.region}'`);
      
      const definitionExpression = expressions.join(' AND ');
      
      layers.forEach(layer => {
        if (shouldFilterLayer(layer)) {
          layer.definitionExpression = definitionExpression;
          console.log(`Applied filter to layer ${layer.title}: ${definitionExpression}`);
        } else {
          console.log(`Skipped filtering for layer ${layer.title}`);
        }
      });
    }

    // Set up UI widgets
    function setupUIWidgets(view, featureLayers, filterLayer) {
      // Add basemap toggle
      const basemapToggle = new BasemapToggle({
        view: view,
        nextBasemap: "hybrid",
        baseMap: "dark-gray-vector"
      });
      view.ui.add(basemapToggle, "bottom-left");
      
      // Add layer list widget with enhanced functionality
      const layerList = new LayerList({ 
        view: view,
        listItemCreatedFunction: function(event) {
          const item = event.item;
          
          // Set Reliability Metrics group to expanded by default
          if (item.layer.title === "Reliability Metrics 2025") {
            item.open = true;  // This expands the group layer
            console.log("Setting Reliability Metrics group to expanded");

            // Rest of the existing Reliability Metrics setup
            console.log("Setting up watchers for Reliability Metrics layer");

            // Wait for layer to be ready
            item.layer.when(() => {
              // Set up watchers for each sublayer
              item.layer.layers.forEach(sublayer => {
                // console.log("Setting up watch for sublayer:", sublayer.title);
                
                sublayer.watch("visible", (visible) => {
                  console.log(`Visibility changed for ${sublayer.title} to ${visible}`);
                  if (visible) {
                    const metricField = getMetricFieldFromTitle(sublayer.title);
                    console.log(`Updating renderer for metric: ${metricField}`);
                    updateLineRenderer(view, metricField);
                  }
                });
              });

              // Also watch for sublayer additions/removals
              item.layer.watch("layers.length", () => {
                console.log("Sublayers changed, updating watchers");
                item.layer.layers.forEach(sublayer => {
                  sublayer.watch("visible", (visible) => {
                    if (visible) {
                      const metricField = getMetricFieldFromTitle(sublayer.title);
                      updateLineRenderer(view, metricField);
                    }
                  });
                });
              });
            });
          }

          // Add layer visibility toggles
          if (item.layer.type !== "group") {
            item.actionsOpen = false;
            item.panel = {
              className: "esri-icon-layer-list",
              content: "legend",
              open: false
            };
          }
        }
      });

      const layerListExpand = new Expand({
        view: view,
        content: layerList,
        expanded: true,
        expandIconClass: "esri-icon-layer-list",
        title: "Layers",
        group: "top-right-widgets",
        mode: "dark"
      });
      
      // Add legend in an expand widget
      const legendExpand = new Expand({
        view: view,
        content: new Legend({ view: view }),
        expanded: false,
        expandIconClass: "esri-icon-legend",
        title: "Legend",
        group: "top-right-widgets",
        mode: "dark"
      });
      view.ui.add(legendExpand, "bottom-right");
      
      // Configure the search widget to make the circuits layer the only searchable source
      const searchWidget = new Search({
        view: view,
        includeDefaultSources: false, // Disable default locators
        sources: [
          {
            layer: view.map.allLayers.find(layer => layer.title === "Reliability_Dissolve_Lines"),
            searchFields: ["CIRCUIT_NAME"],
            displayField: "CIRCUIT_NAME",
            exactMatch: false,
            outFields: ["*"],
            name: "Circuits",
            placeholder: "Search for a circuit by name",
            maxResults: 6,
            maxSuggestions: 6,
            suggestionsEnabled: true,
            minSuggestCharacters: 3
          }
        ]
      });

      view.ui.add(searchWidget, "top-left");

      // Add filter widget if there's a suitable layer for filtering
      if (filterLayer) {
        const filterExpand = new Expand({
          view: view,
          content: createFilterUI(view, featureLayers, filterLayer),
          expanded: true,
          expandIconClass: "esri-icon-filter",
          title: "Filters"
        });
        view.ui.add(filterExpand, "top-left");
      }

      // Add print widget
      const print = new Print({
        view: view,
        // Custom print templates
        templateOptions: {
          title: "Reliability Metrics",
          author: "SCE",
          copyright: "Southern California Edison",
          format: "pdf",
          layout: "letter-ansi-a-landscape",
          // Customizable layout options
          layoutOptions: {
            scalebarUnit: "dual",
            customTextElements: [
              { "Date": new Date().toLocaleDateString() }
            ]
          }
        },
        printServiceUrl: "https://utility.arcgisonline.com/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task"
      });

      const printExpand = new Expand({
        view: view,
        content: print,
        expanded: false,
        expandIconClass: "esri-icon-printer",
        title: "Export Map",
        group: "top-right-widgets",
        mode: "dark"
      });

      const helpExpand = new Expand({
        view: view,
        content: `<div style='padding: 10px; background-color: rgba(0, 0, 0, 0.5); border-radius: 5px;'>
                    <a href='mailto:daniel.mcvey@sce.com?subject=Reliability%20Metrics%20Map%20Help' style="color:rgb(209, 209, 209);text-decoration-line:none;"'>
                      <button style='background-color: transparent; color: white; border: none; cursor: pointer; font-size: 16px;'>
                        Help
                      </button>
                    </a>
                  </div>`,
        expandIconClass: "esri-icon-question",
        expanded: false,
        mode: "floating"
      });

      // Add expand widgets to view
      view.ui.add([
        {
          component: helpExpand,
          position: "top-right",
          index: 0
        },
        {
          component: printExpand,
          position: "top-right",
          index: 1
        },
        {
          component: layerListExpand,
          position: "top-right",
          index: 2
        },
        {
          component: legendExpand,
          position: "bottom-right"
        }
      ]);

      // Watch for expand widget state changes
      reactiveUtils.watch(
        () => [printExpand.expanded, layerListExpand.expanded, legendExpand.expanded],
        ([printExp, layerExp, legendExp]) => {
          // Log the current state for debugging
          console.log("Widget states:", { print: printExp, layers: layerExp, legend: legendExp });
        }
      );
    }
    
    // Helper function to get the field name from layer title
    function getMetricFieldFromTitle(title) {
      const metricMap = {
        'cMAIFI': 'CMAIFI',
        'cSAIFI': 'CSAIFI',
        'cSAIDI': 'CSAIDI',
        'Outages': 'OUTAGES',
        'CAIDI': 'CAIDI',
        'MAIFI': 'MAIFI',
        'SAIFI': 'SAIFI',
        'SAIDI': 'SAIDI'
      };
      return metricMap[title] || title.toUpperCase();
    }

    // Update the dissolve layer renderer based on the active metric
    function updateLineRenderer(view, metricField) {
      console.log(`Attempting to update line renderer for metric: ${metricField}`);
      
      const lineLayer = view.map.allLayers.find(layer => 
        layer.title === "Reliability_Dissolve_Lines"
      );
      
      const metricGroupLayer = view.map.allLayers.find(layer => 
        layer.title === "Reliability Metrics 2025"
      );

      if (!lineLayer || !metricGroupLayer) {
        console.warn("Required layers not found:", 
          {lineLayer: !!lineLayer, metricGroupLayer: !!metricGroupLayer}
        );
        return;
      }

      try {
        // Find the specific metric sublayer
        const activeMetricLayer = metricGroupLayer.layers?.find(layer => {
          const mappedField = getMetricFieldFromTitle(layer.title);
          return mappedField === metricField;
        });

        if (!activeMetricLayer) {
          console.warn("Active metric layer not found for field:", metricField);
          return;
        }

        console.log("Found active metric layer:", activeMetricLayer.title);

        // Wait for the layer to be loaded
        activeMetricLayer.when(() => {
          const pointRenderer = activeMetricLayer.renderer;
        //   console.log("Point layer renderer:", pointRenderer);

          // Extract color stops from visual variables
          let colorStops = [];
          if (pointRenderer.visualVariables) {
            const colorVar = pointRenderer.visualVariables.find(v => v.type === "color");
            if (colorVar && colorVar.stops) {
              colorStops = colorVar.stops.map(stop => ({
                value: stop.value,
                color: stop.color
              }));
              console.log("Extracted color stops:", colorStops);
            }
          }

          if (colorStops.length === 0) {
            console.warn("No color stops found in point layer renderer");
            return;
          }

          // Create width stops based on the same values as color stops
          const widthStops = colorStops.map(stop => ({
            value: stop.value,
            size: 1 + (stop.value / colorStops[colorStops.length - 1].value) * 4 // Scale from 1-5px based on value
          }));

          // Create a new renderer for the line layer
          const lineRenderer = {
            type: "simple",
            symbol: {
              type: "simple-line",
              color: [200, 200, 200], // Default gray for null values
              width: "1px",
              style: "solid"
            },
            visualVariables: [
              {
                type: "color",
                field: metricField,
                stops: colorStops
              },
              {
                type: "size",
                field: metricField,
                stops: widthStops
              }
            ]
          };

        //   console.log("Created line renderer:", lineRenderer);
          
          // Apply the renderer directly to the layer
          lineLayer.renderer = lineRenderer;
          lineLayer.refresh();
          
          console.log(`Successfully applied ${metricField} renderer to ${lineLayer.title}`);
        });

      } catch (error) {
        console.error(`Error updating line renderer:`, error);
        console.error(`Metric field: ${metricField}`);
        console.error(`Point renderer:`, activeMetricLayer?.renderer);
      }
    }

    // Create a custom filter UI
    function createFilterUI(view, layers, filterLayer) {
      const filterDiv = document.createElement("div");
      filterDiv.className = "esri-widget";
      filterDiv.style.padding = "10px";
      filterDiv.style.backgroundColor = "#242424"; // Dark background
      filterDiv.style.width = "250px";
      filterDiv.style.color = "#ffffff"; // Light text
      
      // Check if the filter layer is ready for use
      if (!filterLayer || !filterLayer.loaded) {
        filterDiv.innerHTML = `
          <h3 style="margin-top:0; color:#ffffff;">Filters</h3>
          <p style="color:#ffffff;">Unable to initialize filters. Layer not loaded.</p>
        `;
        return filterDiv;
      }
      
      // Add custom styles for dark theme
      const darkStyles = document.createElement('style');
      darkStyles.textContent = `
        .filter-layer-checkbox {
          accent-color: #0079c1;
        }
        .esri-button {
          background-color: #404040;
          color: #ffffff;
          border: 1px solid #666;
          padding: 6px 12px; /* Smaller padding for buttons */
          font-size: 12px; /* Smaller font size */
        }
        .esri-button:hover {
          background-color: #505050;
        }
        .esri-select {
          background-color: #404040;
          color: #ffffff;
          border: 1px solid #666;
        }
        .filter-section {
          background-color: #333333;
          border: 1px solid #666;
          padding: 5px;
          margin-top: 8px;
        }
        .filter-layers-header {
          color: #bbbbbb;
          font-size: 12px;
          margin: 12px 0 5px 0;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 3px 5px;
        }
        .filter-layers-header:hover {
          background-color: #3a3a3a;
        }
        .filter-button-container {
          display: flex;
          justify-content: space-between;
          margin: 10px 0 5px 0;
        }
        .filter-button-container .esri-button {
          flex: 1;
          margin: 0 5px;
        }
        .filter-button-container .esri-button:first-child {
          margin-left: 0;
        }
        .filter-button-container .esri-button:last-child {
          margin-right: 0;
        }
      `;
      filterDiv.appendChild(darkStyles);
      
      // Check which fields are available on this layer
      const hasCountyField = filterLayer.fields.some(f => f.name === "COUNTY");
      const hasCityField = filterLayer.fields.some(f => f.name === "CITY");
      const hasSubstationField = filterLayer.fields.some(f => f.name === "SUBSTATION");
      const hasDistrictField = filterLayer.fields.some(f => f.name === "DISTRICT");
      const hasRegionField = filterLayer.fields.some(f => f.name === "REGION");
      
      let html = `<h3 style="margin-top:0; color:#ffffff;">Filter by:</h3>`;
      
      // Geographic Filters Group
      html += `
        <div style="background: #333; padding: 10px; margin-bottom: 15px; border-radius: 4px;">
            <!--<h4 style="margin-top:0; margin-bottom:10px; color:#ffffff;">Geographic Filters</h4>-->
            ${hasCountyField ? `
                <div style="margin-bottom:8px">
                    <label for="county-select">County:</label>
                    <select id="county-select" class="esri-select">
                        <option value="">All Counties</option>
                    </select>
                </div>
            ` : ''}
            ${hasCityField ? `
                <div style="margin-bottom:8px">
                    <label for="city-select">City:</label>
                    <select id="city-select" class="esri-select">
                        <option value="">All Cities</option>
                    </select>
                </div>
            ` : ''}
        </div>
      `;

      // Organizational Filters Group
      html += `
          <div style="background: #333; padding: 10px; margin-bottom: 15px; border-radius: 4px;">
              <!--<h4 style="margin-top:0; margin-bottom:10px; color:#ffffff;">Organizational Filters</h4>-->
              ${hasRegionField ? `
                  <div style="margin-bottom:8px">
                      <label for="region-select">Region:</label>
                      <select id="region-select" class="esri-select">
                          <option value="">All Regions</option>
                      </select>
                  </div>
              ` : ''}
              ${hasDistrictField ? `
                  <div style="margin-bottom:8px">
                      <label for="district-select">District:</label>
                      <select id="district-select" class="esri-select">
                          <option value="">All Districts</option>
                      </select>
                  </div>
              ` : ''}
              ${hasSubstationField ? `
                  <div style="margin-bottom:8px">
                      <label for="substation-select">Substation:</label>
                      <select id="substation-select" class="esri-select">
                          <option value="">All Substations</option>
                      </select>
                  </div>
              ` : ''}
          </div>
      `;
      
      // Add compact button container with smaller buttons
      html += `
      <div class="filter-button-container" style="display: flex; justify-content: space-between; gap: 5px;">
          <button id="reset-filters" class="esri-button" title="Reset all filters" style="flex: 1; font-size: 12px; padding: 5px 8px;">
          <span class="esri-icon-erase"></span>
          </button>
          <button id="zoom-to-filtered" class="esri-button" title="Zoom to currently filtered circuits" style="flex: 1; font-size: 12px; padding: 5px 8px;">
          <span class="esri-icon-zoom-in-magnifying-glass"></span>
          </button>
      </div>
      `;
        
      // Add subtle text-only dropdown for filterable layers
      html += `
      <div class="filter-layers-header" id="filter-layers-header" title="Expand to select layers to filter" style="padding: 5px;">
          <span>Apply filters to</span>
          <span id="filter-layers-arrow">▼</span>
      </div>
      <div class="filter-section" id="filter-layers-section" style="display:none; max-height:150px; overflow-y:auto; padding: 5px;">
      `;
      
      layers.forEach((layer) => {
        // Skip non-feature layers or County/District layers
        if (layer.type !== "feature") return;
        if (layer.title.toLowerCase().includes("counties") || layer.title.toLowerCase().includes("district")) return;
        
        const checked = layersToFilter[layer.title] === true ? 'checked' : '';
        html += `
          <div>
            <label>
              <input type="checkbox" class="filter-layer-checkbox" data-layer-id="${layer.id}" data-layer-title="${layer.title}" ${checked}>
              ${layer.title}
            </label>
          </div>
        `;
      });
      
      html += `
        </div>
      `;
  
      filterDiv.innerHTML = html;
      
      // Ensure the filter UI is properly initialized before accessing elements
      const initializeFilterUI = () => {
        const filterDiv = document.getElementById("filterDiv");
        if (!filterDiv) {
          console.error("Filter UI container not found in the DOM.");
          return;
        }

        // Create the filter-layers-header element if it doesn't exist
        let filterLayersHeader = document.getElementById("filter-layers-header");
        if (!filterLayersHeader) {
          filterLayersHeader = document.createElement("div");
          filterLayersHeader.id = "filter-layers-header";
          filterLayersHeader.className = "filter-layers-header";
          filterLayersHeader.innerHTML = `<span>Apply filters to</span><span id="filter-layers-arrow">▼</span>`;
          filterDiv.appendChild(filterLayersHeader);
        }

        // Create the filter-layers-section element if it doesn't exist
        let filterLayersSection = document.getElementById("filter-layers-section");
        if (!filterLayersSection) {
          filterLayersSection = document.createElement("div");
          filterLayersSection.id = "filter-layers-section";
          filterLayersSection.className = "filter-section";
          filterLayersSection.style.display = "none";
          filterDiv.appendChild(filterLayersSection);
        }

        // Add event listener to toggle the filter layers section
        filterLayersHeader.addEventListener("click", () => {
          const arrow = document.getElementById("filter-layers-arrow");
          if (filterLayersSection && arrow) {
            filterLayersSection.style.display = filterLayersSection.style.display === "none" ? "block" : "none";
            arrow.textContent = filterLayersSection.style.display === "none" ? "▼" : "▲";
          }
        });
      };

      // Call the initialization function
      initializeFilterUI();

      // Populate dropdowns and set up event listeners
      setTimeout(() => {
        try {
          console.log(`Setting up filter UI with layer "${filterLayer.title}"`);
          
          // Find the line layer for region values
          const lineLayer = view.map.allLayers.find(layer => 
            layer.title === "Reliability_Dissolve_Lines"
          );

          // Store field availability in an object
          const fields = {
            hasCountyField,
            hasCityField,
            hasRegionField,
            hasDistrictField,
            hasSubstationField
          };

          // Ensure the element exists before adding an event listener
          const filterLayersHeader = document.getElementById("filter-layers-header");
          if (filterLayersHeader) {
            filterLayersHeader.addEventListener("click", () => {
              const section = document.getElementById("filter-layers-section");
              const arrow = document.getElementById("filter-layers-arrow");
              if (section && arrow) {
                section.style.display = section.style.display === "none" ? "block" : "none";
                arrow.textContent = section.style.display === "none" ? "▼" : "▲";
              }
            });
          } else {
            console.warn("Element with ID 'filter-layers-header' not found in the DOM.");
          }

          // Populate dropdowns
          if (fields.hasRegionField && lineLayer) {
            populateDropdown(lineLayer, "REGION", "region-select");
          } else if (fields.hasRegionField) {
            populateDropdown(filterLayer, "REGION", "region-select");
          }
          
          if (hasDistrictField) populateDropdown(filterLayer, "DISTRICT", "district-select");
          if (hasCountyField) populateDropdown(filterLayer, "COUNTY", "county-select");
          if (hasCityField) populateDropdown(filterLayer, "CITY", "city-select");
          if (hasSubstationField) populateDropdown(filterLayer, "SUBSTATION", "substation-select");
          
          // Define layerCheckboxes to reference all checkboxes in the filter UI
          const layerCheckboxes = document.querySelectorAll('.filter-layer-checkbox');

          // Set up event listeners for layer checkboxes
          layerCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
              const layerTitle = e.target.dataset.layerTitle;
              layersToFilter[layerTitle] = e.target.checked;
              console.log(`Layer ${layerTitle} filtering set to: ${e.target.checked}`);
              applyGlobalFilter(layers);
            });
          });
          
          // Set up event listeners for filters with the fields object
          setupFilterEventListeners(filterLayer, layers, fields);

          // Set up event listener for zoom to filtered button
          const zoomToFilteredBtn = document.getElementById("zoom-to-filtered");
          if (zoomToFilteredBtn) {
            zoomToFilteredBtn.addEventListener("click", () => {
              zoomToFilteredFeatures(view, layers);
            });
          }
          
        } catch (error) {
          console.error("Error setting up filter UI:", error);
          filterDiv.innerHTML += `<p style="color:red">Error setting up filters: ${error.message}</p>`;
        }
      }, 1000);
      
      return filterDiv;
    }

    // Function to zoom to filtered features
    async function zoomToFilteredFeatures(view, layers) {
      try {
        // Ensure the loadingIndicator element exists in the DOM
        let loadingIndicator = document.getElementById("loadingIndicator");
        if (!loadingIndicator) {
          loadingIndicator = document.createElement("div");
          loadingIndicator.id = "loadingIndicator";
          loadingIndicator.style.display = "none";
          loadingIndicator.style.position = "absolute";
          loadingIndicator.style.top = "50%";
          loadingIndicator.style.left = "50%";
          loadingIndicator.style.transform = "translate(-50%, -50%)";
          loadingIndicator.style.zIndex = "9999";
          loadingIndicator.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
          loadingIndicator.style.color = "white";
          loadingIndicator.style.padding = "10px";
          loadingIndicator.style.borderRadius = "5px";
          loadingIndicator.innerText = "Loading...";
          document.body.appendChild(loadingIndicator);
        }

        // Find the visible metrics layer for geometry
        const visibleMetricLayer = layers.find(layer => 
          layer.visible && 
          layer.type === "feature" && 
          shouldFilterLayer(layer)
        );

        if (!visibleMetricLayer) {
          console.warn("No visible metrics layer found for zooming to filtered features");
          // Show a notification to the user
          showNotification(view, "No visible filtered layers found", "warning");
          return;
        }

        console.log(`Querying features from visible layer: ${visibleMetricLayer.title}`);

        // Create a query with the current definition expression
        const query = visibleMetricLayer.createQuery();
        query.where = visibleMetricLayer.definitionExpression || "1=1";
        query.returnGeometry = true;
        query.outSpatialReference = view.spatialReference;

        // Use queryExtent to efficiently calculate the combined extent of visible features
        const extentResult = await visibleMetricLayer.queryExtent(query);

        if (extentResult.extent) {
          // Add padding to the extent (10%)
          const padding = {
            top: 50,
            right: 50,
            bottom: 50,
            left: 50
          };

          // Zoom to the extent with animation
          view.goTo({ target: extentResult.extent, padding }, { duration: 1000 })
            .then(() => {
              const featureCount = extentResult.count || 0;
              showNotification(view, `Zoomed to ${featureCount} filtered features`, "info");
            })
            .catch(error => {
              console.error("Error zooming to features:", error);
              showNotification(view, "Error zooming to features", "error");
            });
        } else {
          console.warn("Could not calculate extent from features");
          showNotification(view, "Could not calculate extent from features", "warning");
        }
        
      } catch (error) {
        console.error("Error in zoomToFilteredFeatures:", error);
        // Hide loading indicator if error occurs
        document.getElementById("loadingIndicator").style.display = "none";
        view.ui.remove("loadingIndicator");
        // Show error notification
        showNotification(view, "Error zooming to filtered features", "error");
      }
    }

    // Helper function to show a notification in the map view
    function showNotification(view, message, type = "info") {
      // Create notification container if it doesn't exist
      let notificationDiv = document.getElementById("mapNotification");
      if (!notificationDiv) {
        notificationDiv = document.createElement("div");
        notificationDiv.id = "mapNotification";
        notificationDiv.className = "esri-widget";
        notificationDiv.style.padding = "10px";
        notificationDiv.style.margin = "10px";
        notificationDiv.style.position = "absolute";
        notificationDiv.style.bottom = "20px";
        notificationDiv.style.left = "50%";
        notificationDiv.style.transform = "translateX(-50%)";
        notificationDiv.style.zIndex = "999";
        notificationDiv.style.borderRadius = "4px";
        notificationDiv.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
        notificationDiv.style.pointerEvents = "none"; // Don't block map interactions
        view.ui.add(notificationDiv, "manual");
      }
      
      // Set color based on message type
      switch (type) {
        case "error":
          notificationDiv.style.backgroundColor = "rgba(220, 53, 69, 0.9)";
          break;
        case "warning":
          notificationDiv.style.backgroundColor = "rgba(255, 193, 7, 0.9)";
          notificationDiv.style.color = "#212529";
          break;
        case "success":
          notificationDiv.style.backgroundColor = "rgba(40, 167, 69, 0.9)";
          break;
        case "info":
        default:
          notificationDiv.style.backgroundColor = "rgba(0, 123, 255, 0.9)";
          break;
      }
      
      notificationDiv.innerHTML = message;
      notificationDiv.style.display = "block";
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        notificationDiv.style.display = "none";
      }, 3000);
    }

    // Set up event listeners for filter controls
    function setupFilterEventListeners(filterLayer, layers, fields) {
      // Region select change handler
      if (fields.hasRegionField) {
        const regionSelect = document.getElementById("region-select");
        if (regionSelect) {
          regionSelect.addEventListener("change", (e) => {
            globalFilter.region = e.target.value || null;
            
            // Reset dependent filters
            globalFilter.district = null;
            globalFilter.substation = null;
            
            // Reset geographic filters
            resetGeographicFilters(filterLayer, fields);
            
            // Update dependent dropdowns
            if (fields.hasDistrictField) {
              const districtSelect = document.getElementById("district-select");
              if (districtSelect) {
                districtSelect.innerHTML = '<option value="">All Districts</option>';
                if (globalFilter.region) {
                  updateFilteredDropdown(filterLayer, "DISTRICT", "district-select", "REGION", globalFilter.region);
                }
              }
            }
            applyGlobalFilter(layers);
          });
        }
      }

      // District select change handler
      if (fields.hasDistrictField) {
        const districtSelect = document.getElementById("district-select");
        if (districtSelect) {
          districtSelect.addEventListener("change", (e) => {
            globalFilter.district = e.target.value || null;
            
            // Reset dependent filters
            globalFilter.substation = null;
            
            // Reset geographic filters
            resetGeographicFilters(filterLayer, fields);
            
            // Update dependent dropdowns
            if (fields.hasSubstationField) {
              const substationSelect = document.getElementById("substation-select");
              if (substationSelect) {
                substationSelect.innerHTML = '<option value="">All Substations</option>';
                if (globalFilter.district) {
                  updateFilteredDropdown(filterLayer, "SUBSTATION", "substation-select", "DISTRICT", globalFilter.district);
                }
              }
            }
            applyGlobalFilter(layers);
          });
        }
      }

      // County select change handler
      if (fields.hasCountyField) {
        const countySelect = document.getElementById("county-select");
        if (countySelect) {
          countySelect.addEventListener("change", (e) => {
            globalFilter.county = e.target.value || null;
            
            // Reset organizational filters
            resetOrganizationalFilters(filterLayer, fields);
            
            // Update dependent city dropdown
            if (fields.hasCityField) {
              const citySelect = document.getElementById("city-select");
              if (citySelect) {
                citySelect.innerHTML = '<option value="">All Cities</option>';
                if (globalFilter.county) {
                  updateFilteredDropdown(filterLayer, "CITY", "city-select", "COUNTY", globalFilter.county);
                }
              }
            }
            applyGlobalFilter(layers);
          });
        }
      }

      // City select change handler
      if (fields.hasCityField) {
        const citySelect = document.getElementById("city-select");
        if (citySelect) {
          citySelect.addEventListener("change", (e) => {
            globalFilter.city = e.target.value || null;
            applyGlobalFilter(layers);
            
            // When city changes, reset and repopulate substation dropdown
            if (fields.hasSubstationField) {
              const substationSelect = document.getElementById("substation-select");
              if (substationSelect) {
                substationSelect.innerHTML = '<option value="">All Substations</option>';
                if (globalFilter.city) {
                  updateFilteredDropdown(filterLayer, "SUBSTATION", "substation-select", "CITY", globalFilter.city);
                } else if (globalFilter.county) {
                  updateFilteredDropdown(filterLayer, "SUBSTATION", "substation-select", "COUNTY", globalFilter.county);
                } else {
                  populateDropdown(filterLayer, "SUBSTATION", "substation-select");
                }
                globalFilter.substation = null;
              }
            }
          });
        }
      }
      
      // Substation select change handler
      if (fields.hasSubstationField) {
        const substationSelect = document.getElementById("substation-select");
        if (substationSelect) {
          substationSelect.addEventListener("change", (e) => {
            globalFilter.substation = e.target.value || null;
            applyGlobalFilter(layers);
          });
        }
      }
      
      // Reset filters button
      const resetButton = document.getElementById("reset-filters");
      if (resetButton) {
        resetButton.addEventListener("click", () => {
          globalFilter = {county: null, city: null, substation: null, district: null, region: null};
          
          // Reset district dropdown
          if (fields.hasDistrictField) {
            const districtSelect = document.getElementById("district-select");
            if (districtSelect) {
              districtSelect.value = "";
              populateDropdown(filterLayer, "DISTRICT", "district-select");
            }
          }

          // Reset county dropdown
          if (fields.hasCountyField) {
            const countySelect = document.getElementById("county-select");
            if (countySelect) {
              countySelect.value = "";
              populateDropdown(filterLayer, "COUNTY", "county-select");
            }
          }
          
          // Reset city dropdown
          if (fields.hasCityField) {
            const citySelect = document.getElementById("city-select");
            if (citySelect) {
              citySelect.value = "";
              populateDropdown(filterLayer, "CITY", "city-select");
            }
          }
          
          // Reset substation dropdown
          if (fields.hasSubstationField) {
            const substationSelect = document.getElementById("substation-select");
            if (substationSelect) {
              substationSelect.value = "";
              populateDropdown(filterLayer, "SUBSTATION", "substation-select");
            }
          }

          // Reset region dropdown
          if (fields.hasRegionField) {
            const regionSelect = document.getElementById("region-select");
            if (regionSelect) {
              regionSelect.value = "";
              populateDropdown(filterLayer, "REGION", "region-select");
            }
          }
          
          applyGlobalFilter(layers);
        });
      }

      // Helper function to reset geographic filters
      function resetGeographicFilters(filterLayer, fields) {
        globalFilter.county = null;
        globalFilter.city = null;
        
        if (fields.hasCountyField) {
            const countySelect = document.getElementById("county-select");
            if (countySelect) {
                countySelect.value = "";
            }
        }
        if (fields.hasCityField) {
            const citySelect = document.getElementById("city-select");
            if (citySelect) {
                citySelect.value = "";
            }
        }
      }

      // Helper function to reset organizational filters
      function resetOrganizationalFilters(filterLayer, fields) {
        globalFilter.region = null;
        globalFilter.district = null;
        globalFilter.substation = null;
        
        if (fields.hasRegionField) {
            const regionSelect = document.getElementById("region-select");
            if (regionSelect) {
                regionSelect.value = "";
            }
        }
        if (fields.hasDistrictField) {
            const districtSelect = document.getElementById("district-select");
            if (districtSelect) {
                districtSelect.value = "";
            }
        }
        if (fields.hasSubstationField) {
            const substationSelect = document.getElementById("substation-select");
            if (substationSelect) {
                substationSelect.value = "";
            }
        }
      }
    }
    
    // Populate dropdown with unique values from layer
    async function populateDropdown(layer, fieldName, selectId) {
      if (!layer || !layer.createQuery) {
        console.error(`Layer is invalid or doesn't support queries for field ${fieldName}`);
        return;
      }
      
      const select = document.getElementById(selectId);
      if (!select) {
        console.error(`Select element with id ${selectId} not found`);
        return;
      }
      
      try {
        // Create a query to get all unique values
        const query = layer.createQuery();
        query.outFields = [fieldName]; // Queries the specified field (e.g., "COUNTY")
        query.returnDistinctValues = true; // Ensures only unique values are returned
        query.where = `${fieldName} IS NOT NULL`; // Filters out null values
        query.returnGeometry = false; // Don't need geometry, just attributes
        query.outStatistics = null; // Make sure no statistics are applied
        
        // Try to get all records by setting a high max record count
        query.maxRecordCountFactor = 5;
        query.num = 10000; // Request more records than default
        
        console.log(`Querying ${fieldName} values with:`, query.where);
        
        const results = await layer.queryFeatures(query);
        
        if (results.features && results.features.length > 0) {
          // Create a Set to track unique values and avoid duplicates
          const uniqueValues = new Set();
          
          // Process features and add unique values to the dropdown
          results.features.forEach(feature => {
            const value = feature.attributes[fieldName]; // Gets the value of the "COUNTY" field
            if (value && !uniqueValues.has(value)) {
              uniqueValues.add(value);
              const option = document.createElement("option");
              option.value = value;
              option.text = value; // Adds the value to the dropdown
              select.appendChild(option);
            }
          });
          
          // Sort the dropdown values alphabetically
          const options = Array.from(select.options).slice(1); // Skip the first "All" option
          select.innerHTML = '<option value="">All</option>'; // Changed to just show "All"
          options.sort((a, b) => a.text.localeCompare(b.text))
            .forEach(option => select.add(option));
          
          console.log(`Populated ${uniqueValues.size} unique values for ${fieldName}`);
        } else {
          console.log(`No values found for field ${fieldName}`);
        }
      } catch (error) {
        console.error(`Error populating ${fieldName} dropdown:`, error);
      }
    }
    
    // Populate dropdown with filtered values
    async function updateFilteredDropdown(layer, fieldName, selectId, filterField, filterValue) {
      if (!layer || !layer.createQuery) {
        console.error(`Layer is invalid or doesn't support queries for field ${fieldName}`);
        return;
      }
      
      const select = document.getElementById(selectId);
      if (!select) {
        console.error(`Select element with id ${selectId} not found`);
        return;
      }
      
      try {
        // Create a query with filter
        const query = layer.createQuery();
        query.outFields = [fieldName];
        query.where = `${filterField} = '${filterValue}' AND ${fieldName} IS NOT NULL`;
        query.returnDistinctValues = true;
        query.orderByFields = [fieldName];
        query.returnGeometry = false; // Don't need geometry, just attributes
        query.maxRecordCountFactor = 5;
        query.num = 10000; // Request more records than default
        
        console.log(`Querying filtered ${fieldName} values with:`, query.where);
        
        const results = await layer.queryFeatures(query);
        
        if (results.features && results.features.length > 0) {
          // Create a Set to track unique values and avoid duplicates
          const uniqueValues = new Set();
          
          // Process features and add unique values to the dropdown
          results.features.forEach(feature => {
            const value = feature.attributes[fieldName];
            if (value && !uniqueValues.has(value)) {
              uniqueValues.add(value);
              const option = document.createElement("option");
              option.value = value;
              option.text = value;
              select.appendChild(option);
            }
          });
          
          // Sort the dropdown values alphabetically
          const options = Array.from(select.options).slice(1); // Skip the first "All" option
          select.innerHTML = '<option value="">All ' + fieldName.charAt(0).toUpperCase() + fieldName.slice(1).toLowerCase() + 's</option>';
          options.sort((a, b) => a.text.localeCompare(b.text))
            .forEach(option => select.add(option));
          
          console.log(`Populated ${uniqueValues.size} unique filtered values for ${fieldName}`);
        } else {
          console.log(`No filtered values found for field ${fieldName}`);
        }
      } catch (error) {
        console.error(`Error populating filtered ${fieldName} dropdown:`, error);
      }
    }

    // Find all unique values for a field across multiple layers
    async function findAllUniqueValues(layers, fieldName) {
      const uniqueValues = new Set();
      
      for (const layer of layers) {
        if (!layer.fields || !layer.createQuery) continue;
        
        // Check if layer has this field
        if (!layer.fields.some(f => f.name === fieldName)) continue;
        
        try {
          const query = layer.createQuery();
          query.outFields = [fieldName];
          query.returnDistinctValues = true;
          query.where = `${fieldName} IS NOT NULL`;
          query.returnGeometry = false;
          
          const results = await layer.queryFeatures(query);
          if (results.features) {
            results.features.forEach(feature => {
              const value = feature.attributes[fieldName];
              if (value) uniqueValues.add(value);
            });
          }
        } catch (error) {
          console.warn(`Error querying ${fieldName} from layer ${layer.title}:`, error);
        }
      }
      
      return Array.from(uniqueValues).sort();
    }
    
  }
});
