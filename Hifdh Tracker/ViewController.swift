//
//  ViewController.swift
//  Hifdh Tracker
//
//  Created by سليم عبد الحميد on 6/29/18.
//  Copyright © 2018 meelash. All rights reserved.
//

import Cocoa
import JavaScriptCore

class ViewController: NSViewController {
    @IBOutlet var soorahArrayController: NSArrayController!
    @IBOutlet var aayahArrayController: NSArrayController!
    @objc let managedObjectContext: NSManagedObjectContext
    @objc var aayahFilterPredicate: NSPredicate
    @objc var aayahSortDescriptors: [NSSortDescriptor] = [NSSortDescriptor(key: "number", ascending: true)]
    @IBOutlet weak var datePicker: NSDatePicker!
    
    required init?(coder: NSCoder) {
        self.managedObjectContext = (NSApp.delegate as! AppDelegate).persistentContainer.viewContext
        self.aayahFilterPredicate = NSPredicate(format: "%K == %@", argumentArray: ["soorah.number", 1])
        super.init(coder: coder)
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()

        // Do any additional setup after loading the view.
        soorahArrayController.sortDescriptors = [NSSortDescriptor(key: "number", ascending: true)]
        datePicker.dateValue = Date()
    }

    override var representedObject: Any? {
        didSet {
        // Update the view, if already loaded.
        }
    }
    
    @IBAction func recordRemember(_ sender: Any) {
        answerAayaat(answer: 5, aayaat: aayahArrayController.selectedObjects as! [Aayah])
    }
    
    @IBAction func recordNotKnown(_ sender: Any) {
        answerAayaat(answer: 0, aayaat: aayahArrayController.selectedObjects as! [Aayah])
    }
    
    func answerAayaat(answer: Int, aayaat: [Aayah]) {
        if aayaat.count == 0 {
            return
        }
        let appDelegate = NSApp.delegate as! AppDelegate
        , smSingleton = appDelegate.smSingleton
        , smJSValue = appDelegate.smJSValue
        
        for aayah in aayaat {
            let aayahID = aayah.objectID.uriRepresentation()
            , aayahJSValue = appDelegate.aayaatJSValues[aayahID]
            
            // add item in js for each aayah
            smJSValue!.objectForKeyedSubscript("answer").call(withArguments: [answer, aayahJSValue!, datePicker.dateValue])
            
            // update Aayah entity from updated js item
            let aayahDataJSValue = aayahJSValue!.objectForKeyedSubscript("data").call(withArguments: [])
            aayah.setValuesForKeys([
                "afsString"       : appDelegate.jsContext.objectForKeyedSubscript("JSON").objectForKeyedSubscript("stringify").call(withArguments: [aayahDataJSValue!.objectForKeyedSubscript("_afs")]).toString(),
                "dueDate"         : aayahDataJSValue!.objectForKeyedSubscript("dueDate").toDate(),
                "lapse"           : aayahDataJSValue!.objectForKeyedSubscript("lapse").toInt32(),
                "of"              : aayahDataJSValue!.objectForKeyedSubscript("of").toDouble(),
                "optimumInterval" : aayahDataJSValue!.objectForKeyedSubscript("optimumInterval").toNumber(),
                "previousDate"    : aayahDataJSValue!.objectForKeyedSubscript("previousDate").toDate(),
                "repetition"      : aayahDataJSValue!.objectForKeyedSubscript("repetition").toInt32()
            ])
            
            // add history record for each aayah
            let repetitionEntity = NSEntityDescription.entity(forEntityName: "Repetition", in: managedObjectContext)
            , repetition = NSManagedObject(entity: repetitionEntity!, insertInto: managedObjectContext) as! Repetition
            repetition.setValuesForKeys([
                "date" : datePicker.dateValue,
                "answer" : answer
                ])
            aayah.addToHistory(repetition)
        }
        
        // save full sm object, including items, in string form to smSingleton
        let smDataJSValue = smJSValue!.objectForKeyedSubscript("data").call(withArguments: [])
        smSingleton!.setValue(appDelegate.jsContext.objectForKeyedSubscript("JSON").objectForKeyedSubscript("stringify").call(withArguments: [smDataJSValue!]).toString(), forKey: "savedData")
        
        // save context
        do {
            try managedObjectContext.save()
        } catch let error as NSError {
            print("Could not save. \(error), \(error.userInfo)")
        }
    }
    
    @IBAction func popUpButtonChanged(_ sender: NSPopUpButton) {
        self.setValue(NSPredicate(format: "%K == %u", argumentArray:["soorah.number", Int((sender.selectedItem?.title)!)!]), forKey: "aayahFilterPredicate")
    }
    
    @IBAction func setDateToNow(_ sender: Any) {
        datePicker.dateValue = Date()
    }
}

