/**
 * @summary altEditor
 * @description Lightweight editor for DataTables
 * @version 2.0
 * @file dataTables.editor.free.js
 * @author kingkode (www.kingkode.com)
 *  Modified by: Kasper Olesen (https://github.com/KasperOlesen), Luca Vercelli (https://github.com/luca-vercelli), Zack Hable (www.cobaltdevteam.com)
 * @contact www.kingkode.com/contact
 * @contact zack@cobaltdevteam.com
 * @copyright Copyright 2016 Kingkode
 *
 * This source file is free software, available under the following license: MIT
 * license
 *
 * This source file is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the license files for details.
 *
 *
 */
(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['jquery', 'datatables.net'], function ($) {
            return factory($, window, document);
        });
    }
    else if (typeof exports === 'object') {
        // CommonJS
        module.exports = function (root, $) {
            if (!root) {
                root = window;
            }

            if (!$ || !$.fn.dataTable) {
                $ = require('datatables.net')(root, $).$;
            }

            return factory($, root, root.document);
        };
    }
    else {
        // Browser
        factory(jQuery, window, document);
    }
})
(function ($, window, document, undefined) {
    'use strict';
    var DataTable = $.fn.dataTable;

    var _instance = 0;

    /**
     * altEditor provides modal editing of records for Datatables
     *
     * @class altEditor
     * @constructor
     * @param {object}
     *            oTD DataTables settings object
     * @param {object}
     *            oConfig Configuration object for altEditor
     */
    var altEditor = function (dt, opts) {
        if (!DataTable.versionCheck || !DataTable.versionCheck('1.10.8')) {
            throw ("Warning: altEditor requires DataTables 1.10.8 or greater");
        }

        // User and defaults configuration object
        this.c = $.extend(true, {}, DataTable.defaults.altEditor,
            altEditor.defaults, opts);

        /**
         * @namespace Settings object which contains customisable information
         *            for altEditor instance
         */
        this.s = {
            /** @type {DataTable.Api} DataTables' API instance */
            dt: new DataTable.Api(dt),

            /** @type {String} Unique namespace for events attached to the document */
            namespace: '.altEditor' + (_instance++)
        };

        /**
         * @namespace Common and useful DOM elements for the class instance
         */
        this.dom = {
            /** @type {jQuery} altEditor handle */
            modal: $('<div class="dt-altEditor-handle"/>'),
        };

        /* Constructor logic */
        this._constructor();
    }

    $.extend(
        altEditor.prototype,
        {
            /***************************************************************
             * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
             * Constructor * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
             */

            /**
             * Initialise the RowReorder instance
             *
             * @private
             */
            _constructor: function () {
                var that = this;
                var dt = this.s.dt;

                if (dt.settings()[0].oInit.onAddRow)
                    that.onAddRow = dt.settings()[0].oInit.onAddRow;
                if (dt.settings()[0].oInit.onDeleteRow)
                    that.onDeleteRow = dt.settings()[0].oInit.onDeleteRow;
                if (dt.settings()[0].oInit.onEditRow)
                    that.onEditRow = dt.settings()[0].oInit.onEditRow;

                this._setup();

                dt.on('destroy.altEditor', function () {
                    dt.off('.altEditor');
                    $(dt.table().body()).off(that.s.namespace);
                    $(document.body).off(that.s.namespace);
                });
            },

            /***************************************************************
             * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
             * Private methods * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
             */

            /**
             * Setup dom and bind button actions
             *
             * @private
             */
            _setup: function () {
                var that = this;
                var dt = this.s.dt;
                var modal_id = 'altEditor-modal-' + ("" + Math.random()).replace(".", "");
                this.modal_selector = '#' + modal_id;
                this.form_id = 'altEditor-form-' + ("" + Math.random()).replace(".", "");
                this.form_selector = '#' + this.form_id;
                var modal = '<div class="modal fade" id="' + modal_id + '" tabindex="-1" role="dialog">' +
                    '<div class="modal-dialog">' +
                    '<div class="modal-content">' +
                    '<div class="modal-header">' +
                    '<h4 style="padding-top: 1rem;padding-left: 1rem;" class="modal-title"></h4>' +
                    '<button style="margin: initial;" type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>' +
                    '</div>' +
                    '<div class="modal-body">' +
                    '<p></p>' +
                    '</div>' +
                    '<div class="modal-footer">' +
                    '<button type="button" class="btn btn-default" data-dismiss="modal">Close</button>' + //FIXME need i18n
                    '<input type="submit" form="'+this.form_id+'" class="btn btn-primary"></input>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '</div>';
                // add modal
                $('body').append(modal);

                // add Edit Button
                if (dt.button('edit:name')) {
                    dt.button('edit:name').action(function (e, dt, node, config) {
                        that._openEditModal();
                    });

                    $(this.modal_selector).on('click', '#editRowBtn', function (e) {
                        if (that._inputValidation()) {
                            e.preventDefault();
                            e.stopPropagation();
                            that._editRowData();
                        }
                    });
                }

                // add Delete Button
                if (dt.button('delete:name')) {
                    dt.button('delete:name').action(function (e, dt, node, config) {
                        that._openDeleteModal();
                    });

                    $(this.modal_selector).on('click', '#deleteRowBtn', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        that._deleteRow();
                        $(this).prop('disabled', true);
                    });
                }

                // add Add Button
                if (dt.button('add:name')) {
                    dt.button('add:name').action(function (e, dt, node, config) {
                        that._openAddModal();
                    });

                    $(this.modal_selector).on('click', '#addRowBtn', function (e) {
                        if (that._inputValidation()) {
                            e.preventDefault();
                            e.stopPropagation();
                            that._addRowData();
                        }
                    });
                }

                // add Refresh button
                if (this.s.dt.button('refresh:name')) {
                    this.s.dt.button('refresh:name').action(function (e, dt, node, config) {
                        if (dt.ajax && dt.ajax.url()) {
                            dt.ajax.reload();
                        }
                    });
                }
            },

            /**
             * Emit an event on the DataTable for listeners
             *
             * @param {string}
             *            name Event name
             * @param {array}
             *            args Event arguments
             * @private
             */
            _emitEvent: function (name, args) {
                this.s.dt.iterator('table', function (ctx, i) {
                    $(ctx.nTable).triggerHandler(name + '.dt', args);
                });
            },

            /**
             * Open Edit Modal for selected row
             *
             * @private
             */
            _openEditModal: function () {
                var that = this;
                var dt = this.s.dt;
                var columnDefs = [];

                // Adding column attributes to object.
                // Please set the ID as readonly.
                for (var i in dt.context[0].aoColumns) {
                    var obj = dt.context[0].aoColumns[i];
                    columnDefs[i] = {
                        title: obj.sTitle,
                        name: obj.data ? obj.data : obj.mData,
                        type: (obj.type ? obj.type : 'text'),
                        options: (obj.options ? obj.options : []),
                        msg: (obj.errorMsg ? obj.errorMsg : ''),
                        hoverMsg: (obj.hoverMsg ? obj.hoverMsg : ''),
                        pattern: (obj.pattern ? obj.pattern : '.*'),
                        special: (obj.special ? obj.special : ''),
                        unique: (obj.unique ? obj.unique : false),
                        uniqueMsg: (obj.uniqueMsg ? obj.uniqueMsg : ''),
                        maxLength: (obj.maxLength ? obj.maxLength : false),
                        multiple: (obj.multiple ? obj.multiple : false),
                        select2: (obj.select2 ? obj.select2 : false),
                        datepicker: (obj.datepicker ? obj.datepicker : false),
                        required: (obj.required ? obj.required : false),
                        customValidation: (obj.customValidation ? true : false),
                        max: (!isNaN(obj.max) ? obj.max : undefined),
                        min: (!isNaN(obj.min) ? obj.min : undefined),
                        formatData: (obj.formatData ? true : false)
                    };
                }
                var adata = dt.rows({
                    selected: true
                });

                // Building edit-form
                var data = "";

                data += "<form name='"+this.form_id+"' role='form'>";

                for (var j in columnDefs) {
                    // handle hidden fields
                    if (columnDefs[j].type.indexOf("hidden") >= 0) {
                        data += "<input type='hidden' id='" + columnDefs[j].name + "' value='" + adata.data()[0][columnDefs[j].name] + "'></input>";
                    }
                    else {
                        // handle fields that are visible to the user
                        data += "<div style='margin-left: initial;margin-right: initial;' class='form-group row'>"
                        data += "<div class='col-sm-3 col-md-3 col-lg-3 text-right' style='padding-top:4px;'>"
                        data += "<label for='" + columnDefs[j].name + "'>" + columnDefs[j].title + ":</label>"
                        + (!columnDefs[j].required ? "" : "<span class='ms-formvalidation'>*</span>")+"</div>"
                        data += "<div class='col-sm-8 col-md-8 col-lg-8'>";

                        // Adding text-inputs and errorlabels
                        if (columnDefs[j].type.indexOf("text") >= 0 || columnDefs[j].type.indexOf("number") >= 0) {
                            data += "<input type='"
                                + that._quoteattr(columnDefs[j].type)
                                + "' id='"
                                + that._quoteattr(columnDefs[j].name)
                                + "'  pattern='"
                                + that._quoteattr(columnDefs[j].pattern)
                                + "'  title='"
                                + that._quoteattr(columnDefs[j].hoverMsg)
                                + "' name='"
                                + that._quoteattr(columnDefs[j].title)
                                + "' placeholder='"
                                + that._quoteattr(columnDefs[j].title)
                                + "' data-special='"
                                + that._quoteattr(columnDefs[j].special)
                                + "' data-errorMsg='"
                                + that._quoteattr(columnDefs[j].msg)
                                + "' data-uniqueMsg='"
                                + that._quoteattr(columnDefs[j].uniqueMsg)
                                + "' data-unique='"
                                + columnDefs[j].unique
                                + "'"
                                + (columnDefs[j].maxLength ? " maxlength='" + columnDefs[j].maxLength + "'": "")
                                + (!isNaN(columnDefs[j].max)&&columnDefs[j].type.indexOf("number") >= 0 ? " max='" + columnDefs[j].max + "'": "")
                                + (!isNaN(columnDefs[j].min)&&columnDefs[j].type.indexOf("number") >= 0 ? " min='" + columnDefs[j].min + "'": "")
                                + " coll-number='" + j + "'" + " custom-validation='" + columnDefs[j].customValidation + "'"+ " format-data='" + columnDefs[j].formatData + "'"
                                + " style='overflow:hidden'  class='form-control  form-control-sm' value='"
                                + that._quoteattr(adata.data()[0][columnDefs[j].name]) + "' "+
                                + (!columnDefs[j].required ? "" : "required")
                                +">";
                            data += "<label id='" + columnDefs[j].name + "label"
                                + "' class='errorLabel'></label>";
                        }

                        // Adding readonly-fields
                        if (columnDefs[j].type.indexOf("readonly") >= 0) {
                            data += "<input type='text' readonly  id='"
                                + columnDefs[j].name
                                + "' name='"
                                + columnDefs[j].title
                                + "' placeholder='"
                                + columnDefs[j].title
                                + "' style='overflow:hidden'  class='form-control  form-control-sm' value='"
                                + adata.data()[0][columnDefs[j].name] + "'>";
                        }

                        // Adding select-fields
                        if (columnDefs[j].type.indexOf("select") >= 0) {
                            var options = "";
                            for (var i = 0; i < columnDefs[j].options.length; i++) {
                                // Assigning the selected value of the <selected> option
                                if (adata.data()[0][columnDefs[j].name]
                                    .indexOf(columnDefs[j].options[i])>= 0) {
                                    options += "<option value='"
                                        + columnDefs[j].options[i] + "'selected>"
                                        + columnDefs[j].options[i] + "</option>";
                                } else {
                                    options += "<option value='"
                                        + columnDefs[j].options[i] + "'>"
                                        + columnDefs[j].options[i] + "</option>";
                                }
                            }
                            data += "<select class='form-control" + (columnDefs[j].select2 ? ' select2' : '') + "' id='" + columnDefs[j].name + "' name='" + columnDefs[j].title + "' " + (columnDefs[j].multiple ? 'multiple' : '') 
                            + " coll-number='" + j + "'" + " custom-validation='" + columnDefs[j].customValidation + "'"
                            + ">" + options
                            + "</select>";
                        }
                        data += "</div><div style='clear:both;'></div></div>";

                    }
                }
                // close form
                data += "</form>";
                var selector = this.modal_selector;
                $(selector).on('show.bs.modal', function () {
                    var btns = '<button type="button" data-content="remove" class="btn btn-default" data-dismiss="modal" id="editRowBtnClose">Close</button>' +
                        '<button type="button" data-content="remove" class="btn btn-primary" id="editRowBtn">Save</button>';
                    $(selector).find('.modal-title').html('Edit Record');
                    $(selector).find('.modal-body').html(data);
                    $(selector).find('.modal-footer').html(btns);
                });

                $(selector).modal('show');
                $(selector + ' input[0]').focus();

                // enable select 2 items
                for (var j in columnDefs) {
                    if (columnDefs[j].select2) {
                        // require select2
                        $(selector).find("select#" + columnDefs[j].name).select2(columnDefs[j].select2);
                    }
                }

                // enable datepicker
                for (var j in columnDefs) {
                    if (columnDefs[j].datepicker) {
                        // Require jquery-ui
                        $(selector).find("#" + columnDefs[j].name).datepicker(columnDefs[j].datepicker);
                    }
                }
            },

            /**
             * Callback for "Edit" button
             */
            _editRowData: function () {
                var that = this;
                var dt = this.s.dt;

                // Complete new row data
                var rowDataArray = {};

                var adata = dt.rows({
                    selected: true
                });

                // Getting the inputs from the edit-modal
                $('form[name="'+this.form_id+'"] *').filter(':input').each(function (i) {
                    var entryData = $(this).val();
                    if ($(this).attr("format-data") == "true")
                        entryData = dt.context[0].aoColumns[parseInt($(this).attr("coll-number"))].formatData(entryData);
                    rowDataArray[$(this).attr('id')] = entryData;
                });

                if(console != undefined)console.log(rowDataArray); //DEBUG

                that.onEditRow(that,
                    rowDataArray,
                    function(data,b,c,d,e){ that._editRowCallback(data,b,c,d,e); },
                    function(data){ that._errorCallback(data);
                });
            },

            /**
             * Open Delete Modal for selected row
             *
             * @private
             */
            _openDeleteModal: function () {
                var that = this;
                var dt = this.s.dt;
                var columnDefs = [];

                // Adding attribute IDs and values to object
                for (var i in dt.context[0].aoColumns) {
                    columnDefs.push({
                        title: dt.context[0].aoColumns[i].sTitle,
                        type: (dt.context[0].aoColumns[i].type ? dt.context[0].aoColumns[i].type : 'text'),
                        name: dt.context[0].aoColumns[i].data ? dt.context[0].aoColumns[i].data : dt.context[0].aoColumns[i].mData
                    });
                }
                var adata = dt.rows({
                    selected: true
                });

                // Building delete-modal
                var data = "";

                data += "<form name='"+this.form_id+"' role='form'>";
                for (var j in columnDefs) {
                    if (columnDefs[j].type.indexOf("hidden") >= 0) {
                        data += "<input type='hidden' id='" + columnDefs[j].title + "' value='" + adata.data()[0][columnDefs[j].name] + "'></input>";
                    }
                    else {
                        data += "<div style='margin-left: initial;margin-right: initial;' class='form-group row'><label for='"
                            + that._quoteattr(columnDefs[j].name)
                            + "'>"
                            + columnDefs[j].title
                            + ":&nbsp</label> <input  type='hidden'  id='"
                            + that._quoteattr(columnDefs[j].title)
                            + "' name='"
                            + that._quoteattr(columnDefs[j].title)
                            + "' placeholder='"
                            + that._quoteattr(columnDefs[j].title)
                            + "' style='overflow:hidden'  class='form-control' value='"
                            + that._quoteattr(adata.data()[0][columnDefs[j].name]) + "' >"
                            + adata.data()[0][columnDefs[j].name]
                            + "</input></div>";
                    }
                }
                // close the form
                data += "</form>";

                var selector = this.modal_selector;
                $(selector).on('show.bs.modal', function () {
                    var btns = '<button type="button" data-content="remove" class="btn btn-default" data-dismiss="modal" id="deleteRowBtnClose">Close</button>' +
                        '<button type="button"  data-content="remove" class="btn btn-danger" id="deleteRowBtn">Delete</button>';
                    $(selector).find('.modal-title').html('Delete Record');
                    $(selector).find('.modal-body').html(data);
                    $(selector).find('.modal-footer').html(btns);
                });

                $(selector).modal('show');
                $(selector + ' input[0]').focus();
            },

            /**
             * Callback for "Delete" button
             */
            _deleteRow: function () {
                var that = this;
                var dt = this.s.dt;

                var jsonDataArray = {};

                var adata = dt.rows({
                    selected: true
                });

                // Getting the IDs and Values of the tablerow
                for (var i = 0; i < dt.context[0].aoColumns.length; i++) {
                    // .data is the attribute name, if any; .idx is the column index, so it should always exists 
                    var name = dt.context[0].aoColumns[i].data ? dt.context[0].aoColumns[i].data :
                            dt.context[0].aoColumns[i].mData ? dt.context[0].aoColumns[i].mData :
                            dt.context[0].aoColumns[i].idx;
                    jsonDataArray[name] = adata.data()[0][name];
                }
                that.onDeleteRow(that,
                    jsonDataArray,
                    function(data){ that._deleteRowCallback(data); },
                    function(data){ that._errorCallback(data);
                });
            },

            /**
             * Open Add Modal for selected row
             *
             * @private
             */
            _openAddModal: function () {
                var that = this;
                var dt = this.s.dt;
                var columnDefs = [];

                // Adding column attributes to object.
                for (var i in dt.context[0].aoColumns) {
                    var obj = dt.context[0].aoColumns[i];
                    columnDefs[i] = {
                        title: obj.sTitle,
                        name: (obj.data ? obj.data : obj.mData),
                        type: (obj.type ? obj.type : 'text'),
                        options: (obj.options ? obj.options : []),
                        msg: (obj.errorMsg ? obj.errorMsg : ''),
                        hoverMsg: (obj.hoverMsg ? obj.hoverMsg : ''),
                        pattern: (obj.pattern ? obj.pattern : '.*'),
                        special: (obj.special ? obj.special : ''),
                        unique: (obj.unique ? obj.unique : false),
                        uniqueMsg: (obj.uniqueMsg ? obj.uniqueMsg : ''),
                        maxLength: (obj.maxLength ? obj.maxLength : false),
                        multiple: (obj.multiple ? obj.multiple : false),
                        select2: (obj.select2 ? obj.select2 : false),
                        datepicker: (obj.datepicker ? obj.datepicker : false),
                        required: (obj.required ? obj.required : false),
                        customValidation: (obj.customValidation ? true : false),
                        defaultValue: (typeof obj.defaultValue == "function" ? obj.defaultValue() : obj.defaultValue),
                        max: (!isNaN(obj.max) ? obj.max : undefined),
                        min: (!isNaN(obj.min) ? obj.min : undefined),
                        formatData: (obj.formatData ? true : false)
                    }
                }

                if(console!= undefined)console.log(columnDefs);
                // Building add-form
                var data = "";
                data += "<form name='"+this.form_id+"' role='form'>";
                for (var j in columnDefs) {
                    if (columnDefs[j].type.indexOf("hidden") >= 0) {
                        // just do nothing for hidden fields!
                    }
                    else {
                        data += "<div style='margin-left: initial;margin-right: initial;' class='form-group row'><div class='col-sm-3 col-md-3 col-lg-3 text-right' style='padding-top:4px;'><label for='"
                            + columnDefs[j].name
                            + "'>"
                            + columnDefs[j].title
                            + ":</label>"
                            + (!columnDefs[j].required ? "" : "<span class='ms-formvalidation'>*</span>")
                            + "</div><div class='col-sm-8 col-md-8 col-lg-8'>";

                        // Adding text-inputs and errorlabels
                        if (columnDefs[j].type.indexOf("text") >= 0||columnDefs[j].type.indexOf("number") >= 0) {
                            data += "<input type='"
                                + that._quoteattr(columnDefs[j].type)
                                + "' id='"
                                + that._quoteattr(columnDefs[j].name)
                                + "'  pattern='"
                                + that._quoteattr(columnDefs[j].pattern)
                                + "'  title='"
                                + that._quoteattr(columnDefs[j].hoverMsg)
                                + "' name='"
                                + that._quoteattr(columnDefs[j].title)
                                + "' placeholder='"
                                + that._quoteattr(columnDefs[j].title)
                                + "' data-special='"
                                + columnDefs[j].special
                                + "' data-errorMsg='"
                                + that._quoteattr(columnDefs[j].msg)
                                + "' data-uniqueMsg='"
                                + that._quoteattr(columnDefs[j].uniqueMsg)
                                + "' data-unique='"
                                + columnDefs[j].unique
                                + "'"
                                + (columnDefs[j].maxLength ? " maxlength='" + columnDefs[j].maxLength + "'" : "")
                                + (!isNaN(columnDefs[j].max)&&columnDefs[j].type.indexOf("number") >= 0 ? " max='" + columnDefs[j].max + "'": "")
                                + (!isNaN(columnDefs[j].min)&&columnDefs[j].type.indexOf("number") >= 0 ? " min='" + columnDefs[j].min + "'": "")
                                + " coll-number='" + j + "'" + " custom-validation='" + columnDefs[j].customValidation + "'"+ " format-data='" + columnDefs[j].formatData + "'"
                                + " style='overflow:hidden'  class='form-control  form-control-sm' value='"+(columnDefs[j].defaultValue?columnDefs[j].defaultValue:"")+"' "
                                + (!columnDefs[j].required ? "" : "required")
                                +">";
                            data += "<label id='" + that._quoteattr(columnDefs[j].name) + "label"
                                + "' class='errorLabel'></label>";
                        }

                        // Adding readonly-fields
                        if (columnDefs[j].type.indexOf("readonly") >= 0) {
                            data += "<input type='text' readonly  id='"
                                + that._quoteattr(columnDefs[j].name)
                                + "' name='"
                                + that._quoteattr(columnDefs[j].title)
                                + "' placeholder='"
                                + that._quoteattr(columnDefs[j].title)
                                + "' style='overflow:hidden'  class='form-control  form-control-sm' value=''>";
                        }

                        // Adding select-fields
                        if (columnDefs[j].type.indexOf("select") >= 0) {
                            var options = "";
                            for (var i = 0; i < columnDefs[j].options.length; i++) {
                                if (columnDefs[j].defaultValue == columnDefs[j].options[i]) {
                                    options += "<option value='" + that._quoteattr(columnDefs[j].options[i])
                                        + "' selected>" + columnDefs[j].options[i] + "</option>";
                                } else {
                                    options += "<option value='" + that._quoteattr(columnDefs[j].options[i])
                                        + "'>" + columnDefs[j].options[i] + "</option>";
                                }
                                // options += "<option value='" + that._quoteattr(columnDefs[j].options[i])
                                //     + "'>" + columnDefs[j].options[i] + "</option>";
                            }
                            data += "<select class='form-control" + (columnDefs[j].select2 ? ' select2' : '') + "' id='" + that._quoteattr(columnDefs[j].name) + "' name='" + that._quoteattr(columnDefs[j].title) + "' " + (columnDefs[j].multiple ? 'multiple' : '') 
                                + " coll-number='" + j + "'" + " custom-validation='" + columnDefs[j].customValidation + "'"
                                + ">" + options
                                + "</select>";
                            data += "<label id='" + that._quoteattr(columnDefs[j].name) + "label"
                                + "' class='errorLabel'></label>";
                        }
                        data += "</div><div style='clear:both;'></div></div>";
                    }
                }
                data += "</form>";

                var selector = this.modal_selector;
                $(selector).on('show.bs.modal', function () {
                    var btns = '<button type="button" data-content="remove" class="btn btn-default" data-dismiss="modal" id="addRowBtnClose">Close</button>' +
                        '<button type="button"  data-content="remove" class="btn btn-primary" id="addRowBtn">Add</button>';
                    $(selector).find('.modal-title').html(
                        'Add Record');
                    $(selector).find('.modal-body')
                        .html(data);
                    $(selector)
                        .find('.modal-footer')
                        .html(btns);
                });

                $(selector).modal('show');
                $(selector + ' input[0]').focus();

                // enable select 2 items
                for (var j in columnDefs) {
                    if (columnDefs[j].select2) {
                        $(selector).find("select#" + columnDefs[j].name).select2(columnDefs[j].select2);
                    }
                }
            },

            /**
             * Callback for "Add" button
             */
            _addRowData: function () {
                var that = this;
                var dt = this.s.dt;
                var rowDataArray = {};
                // Getting the inputs from the modal
                $('form[name="'+this.form_id+'"] *').filter(':input').each(function (i) {
                    var entryData = $(this).val();
                    if ($(this).attr("format-data") == "true")
                        entryData = dt.context[0].aoColumns[parseInt($(this).attr("coll-number"))].formatData(entryData);
                    rowDataArray[$(this).attr('id')] = entryData;
                });

                if(console != undefined)console.log(rowDataArray); //DEBUG

                that.onAddRow(that,
                    rowDataArray,
                    function(data){ that._addRowCallback(data); },
                    function(data){ that._errorCallback(data);
                });

            },

            /**
             * Called after a row has been deleted on server
             */
            _deleteRowCallback: function (response, status, more) {
                    var selector = this.modal_selector;
                    $(selector + ' .modal-body .alert').remove();

                    var message = '<div class="alert alert-success" role="alert">' +
                        '<strong>Success!</strong>' +
                        '</div>';
                    $(selector + ' .modal-body').append(message);

                    this.s.dt.row({
                        selected : true
                    }).remove();
                    this.s.dt.draw();

                    // Disabling submit button
                    // $("div"+selector).find("button#addRowBtn").prop('disabled', true);
                    // $("div"+selector).find("button#editRowBtn").prop('disabled', true);
                    // $("div"+selector).find("button#deleteRowBtn").prop('disabled', true);
                    $("div"+selector).find("button#addRowBtnClose").trigger("click");
                    $("div"+selector).find("button#editRowBtnClose").trigger("click");
                    $("div"+selector).find("button#deleteRowBtnClose").trigger("click");
            },

            /**
             * Called after a row has been inserted on server
             */
            _addRowCallback: function (response, status, more) {
                
                    //TODO should honor dt.ajax().dataSrc
                    
                    var data = (typeof response === "string") ? JSON.parse(response) : response;
                    var selector = this.modal_selector;
                    $(selector + ' .modal-body .alert').remove();

                    var message = '<div class="alert alert-success" role="alert">' +
                        '<strong>Success!</strong>' +
                        '</div>';
                    $(selector + ' .modal-body').append(message);

                    this.s.dt.row.add(data).draw(false);

                    // Disabling submit button
                    // $("div" + selector).find("button#addRowBtn").prop('disabled', true);
                    // $("div" + selector).find("button#editRowBtn").prop('disabled', true);
                    // $("div" + selector).find("button#deleteRowBtn").prop('disabled', true);
                    $("div"+selector).find("button#addRowBtnClose").trigger("click");
                    $("div"+selector).find("button#editRowBtnClose").trigger("click");
                    $("div"+selector).find("button#deleteRowBtnClose").trigger("click");
            },

            /**
             * Called after a row has been updated on server
             */
            _editRowCallback: function (response, status, more) {

                    //TODO should honor dt.ajax().dataSrc
                    
                    var data = (typeof response === "string") ? JSON.parse(response) : response;
                    var selector = this.modal_selector;
                    $(selector + ' .modal-body .alert').remove();

                    var message = '<div class="alert alert-success" role="alert">' +
                        '<strong>Success!</strong>' +
                        '</div>';
                    $(selector + ' .modal-body').append(message);

                    this.s.dt.row({
                        selected : true
                    }).data(data);
                    this.s.dt.draw();

                    // Disabling submit button
                    // $("div" + selector).find("button#addRowBtn").prop('disabled', true);
                    // $("div" + selector).find("button#editRowBtn").prop('disabled', true);
                    // $("div" + selector).find("button#deleteRowBtn").prop('disabled', true);
                    $("div"+selector).find("button#addRowBtnClose").trigger("click");
                    $("div"+selector).find("button#editRowBtnClose").trigger("click");
                    $("div"+selector).find("button#deleteRowBtnClose").trigger("click");
            },

            /**
             * Called after AJAX server returned an error
             */
            _errorCallback: function (response, status, more) {
                    var error = response;
                    var selector = this.modal_selector;
                    $(selector + ' .modal-body .alert').remove();
                    var errstr = "There was an unknown error!";
                    if (error.responseJSON && error.responseJSON.errors) {
                        errstr = "";
                        for (var key in error.responseJSON.errors) {
                            errstr += error.responseJSON.errors[key][0];
                        }
                    }
                    var message = '<div class="alert alert-danger" role="alert">' +
                        '<strong>Error!</strong> ' + (error.status == null ? "" : 'Response code: ' + error.status) + " " + errstr +
                        '</div>';

                    $(selector + ' .modal-body').append(message);
            },
            
            /**
             * Default callback for insertion: mock webservice, always success.
             */
            onAddRow: function(dt, rowdata, success, error) {
                if(console != undefined)console.log("Missing AJAX configuration for INSERT");
                success(rowdata);
            },

            /**
             * Default callback for editing: mock webservice, always success.
             */
            onEditRow: function(dt, rowdata, success, error) {
                if(console != undefined)console.log("Missing AJAX configuration for UPDATE");
                success(rowdata);
            },

            /**
             * Default callback for deletion: mock webservice, always success.
             */
            onDeleteRow: function(dt, rowdata, success, error) {
                if(console != undefined)console.log("Missing AJAX configuration for DELETE");
                success(rowdata);
            },

            /**
             * Validates input
             * @returns {boolean}
             * @private
             */
            _inputValidation: function () {
                var that = this;
                var dt = this.s.dt;
                var isValid = false;
                var errorcount = 0;
                // Looping through all text fields
                //if(console != undefined)console.log($(".modal.show").find('form[name="'+this.form_id+'"] *').filter(':text, input[type=number], select'));
                $(".modal.show").find('form[name="'+this.form_id+'"] *').filter(':text, input[type=number], select').each(function (i) {
                        var errorLabel = "#" + $(this).attr("id") + "label";
                        // reset error display
                        $(errorLabel).hide();
                        $(errorLabel).empty();
                        //if(console != undefined)console.log($(this).attr("custom-validation") == "true",$(this).attr("coll-number"));
                        if($(this).prop('required')&&!$(this).val()){
                            $(errorLabel).html("This field is required !");
                            $(errorLabel).show();
                            errorcount++;
                        }
                        else if (!$(this).val().match($(this).attr("pattern"))) {
                            $(errorLabel).html($(this).attr("data-errorMsg"));
                            $(errorLabel).show();
                            errorcount++;
                        }
                        else if ($(this).prop("maxlength"))
                            if($(this).val().length > parseInt($(this).attr("maxlength"))){
                                $(errorLabel).html("Max length cannot be more then "+$(this).attr("maxlength"));
                                $(errorLabel).show();
                                errorcount++;
                            }
                        else if ($(this).prop("max")&&$(this).attr("type")=="number"&&$(this).val())
                            if(parseFloat($(this).val()) > parseFloat($(this).attr("max"))){
                                $(errorLabel).html("Max value cannot be more then "+$(this).attr("max"));
                                $(errorLabel).show();
                                errorcount++;
                            }
                        else if ($(this).prop("min")&&$(this).attr("type")=="number"&&$(this).val())
                            if(parseFloat($(this).val()) < parseFloat($(this).attr("min"))){
                                $(errorLabel).html("Min value cannot be less then "+$(this).attr("min"));
                                $(errorLabel).show();
                                errorcount++;
                            }
                        // now check if its should be unique
                        if ($(this).attr("data-unique") == "true") {
                            // go through each item in this column
                            var colData = dt.column("th:contains('" + $(this).attr("name") + "')").data();
                            var selectedCellData = null;
                            if (dt.row({selected: true}).index() != null)
                                selectedCellData = dt.cell(dt.row({selected: true}).index(), dt.column("th:contains('" + $(this).attr("name") + "')").index()).data();
                            for (var j in colData) {
                                // if the element is in the column and its not the selected one then its not unique
                                if ($(this).val() == colData[j] && colData[j] != selectedCellData) {
                                    $(errorLabel).html($(this).attr("data-uniqueMsg"));
                                    $(errorLabel).show();
                                    errorcount++;
                                }
                            }
                        }
                        if ($(this).attr("custom-validation") == "true"){
                            //if(console != undefined)console.log(dt.context[0].aoColumns[parseInt($(this).attr("coll-number"))]);
                            var validationResult = dt.context[0].aoColumns[parseInt($(this).attr("coll-number"))].customValidation($(this).val());
                            if(typeof validationResult == "string"){
                                $(errorLabel).html(validationResult);
                                $(errorLabel).show();
                                errorcount++;
                            }
                        }
                    });

                if (errorcount == 0) {
                    isValid = true;
                }

                return isValid;
            },

            /**
             * Sanitizes input for use in HTML
             * @param s
             * @param preserveCR
             * @returns {string}
             * @private
             */
            _quoteattr: function (s, preserveCR) {
                if (s == null)
                    return "";
                preserveCR = preserveCR ? '&#13;' : '\n';
                return ('' + s) /* Forces the conversion to string. */
                    .replace(/&/g, '&amp;') /* This MUST be the 1st replacement. */
                    .replace(/'/g, '&apos;') /* The 4 other predefined entities, required. */
                    .replace(/"/g, '&quot;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/\r\n/g, preserveCR) /* Must be before the next replacement. */
                    .replace(/[\r\n]/g, preserveCR);
            },
        });

    /**
     * altEditor version
     *
     * @static
     * @type String
     */
    altEditor.version = '2.0';

    /**
     * altEditor defaults
     *
     * @namespace
     */
    altEditor.defaults = {
        /**
         * @type {Boolean} Ask user what they want to do, even for a single
         *       option
         */
        alwaysAsk: false,

        /** @type {string|null} What will trigger a focus */
        focus: null, // focus, click, hover

        /** @type {column-selector} Columns to provide auto fill for */
        columns: '', // all

        /** @type {boolean|null} Update the cells after a drag */
        update: null, // false is editor given, true otherwise

        /** @type {DataTable.Editor} Editor instance for automatic submission */
        editor: null
    };

    /**
     * Classes used by altEditor that are configurable
     *
     * @namespace
     */
    altEditor.classes = {
        /** @type {String} Class used by the selection button */
        btn: 'btn'
    };

    // Attach a listener to the document which listens for DataTables
    // initialisation
    // events so we can automatically initialise
    $(document).on('preInit.dt.altEditor', function (e, settings, json) {
        if (e.namespace !== 'dt') {
            return;
        }

        var init = settings.oInit.altEditor;
        var defaults = DataTable.defaults.altEditor;

        if (init || defaults) {
            var opts = $.extend({}, init, defaults);

            if (init !== false) {
                new altEditor(settings, opts);
            }
        }
    });

    // Alias for access
    DataTable.altEditor = altEditor;
    return altEditor;
});
