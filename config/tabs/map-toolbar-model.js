/*global define*/

define([
    'jquery',
     "fx-v-b/config/tabs/shared-toolbar-model"
],
    function ($, Shared) {

    'use strict';

    return $.extend(true, {}, {

        map_boundaries: {
            selector : {
                id : "mapboundaries",
                type : "checkbox",
                source : [ { value : true, label :"Show Map Boundaries"}]
            }
        },

        map_labels: {
            selector : {
                id : "maplabels",
                type : "checkbox",
                source : [ { value : true, label :"Show Map Labels"}]
            }
        },

        /*"maptoolbar": {

            selector: {
                id: "sortable",
                source : [
                    {value: "1", label: "layer1"},
                    {value: "2", label: "layer2"},
                    {value: "3", label: "layer3"}
                ],
                config: {
                    itemRender:  function (model) {

                        var $el = $("<h1>[LAYER BOX " +model.label + "]</h1>");

                        $el.on("click", function () {
                            alert('Active layer')
                        })

                        return $el;
                    }
                }
            },
            template: {
                title: "Map Filter"
            }
        }//*/

    }, Shared)

});