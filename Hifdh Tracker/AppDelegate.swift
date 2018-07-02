//
//  AppDelegate.swift
//  Hifdh Tracker
//
//  Created by سليم عبد الحميد on 6/29/18.
//  Copyright © 2018 meelash. All rights reserved.
//

import Cocoa
import JavaScriptCore

@NSApplicationMain
class AppDelegate: NSObject, NSApplicationDelegate {
    var managedObjectContext: NSManagedObjectContext!
    ,jsContext: JSContext = JSContext()
    ,smSingleton: SMSingleton!
    ,smJSValue: JSValue!
    ,aayaatJSValues: [URL : JSValue] = [:]

    func buildDataFromQuranFiles() {
        var allAayaat: [Aayah] = []
        
        let quranFilePaths = Bundle.main.paths(forResourcesOfType: "txt", inDirectory: "Quran Stats/s")
        for filePath in quranFilePaths {
            let regex = try? NSRegularExpression(pattern: ".*\\/(.*?).txt$", options: .caseInsensitive)
            let range = regex?.matches(in: filePath, options: [], range: NSRange(location: 0, length: (filePath as NSString).length))[0].range(at: 1)
            let soorahNumber = String(filePath[Range(range!, in: filePath)!])
            let soorah = Soorah(context: managedObjectContext)
            soorah.setValue(Int(soorahNumber), forKey: "number")
            
            let contents = try? String.init(contentsOfFile: filePath)
            for (index, aayahString) in (contents?.split(separator: "\n"))!.enumerated() {
                let aayah = Aayah(context: managedObjectContext)
                aayah.setValue(index+1, forKey: "number")
                aayah.setValue(String(aayahString), forKey: "text")
                aayah.setValue(soorah, forKey: "soorah")
                allAayaat.append(aayah)
            }
        }
        
        // need to save here so that objectID's get set to permanent values before creating JSValues items with those
        do {
            try managedObjectContext.save()
        } catch let error as NSError {
            print("Could not save. \(error), \(error.userInfo)")
        }
        
        for aayah in allAayaat {
            let idURL = aayah.objectID.uriRepresentation()
            ,aayahJSValue = smJSValue.objectForKeyedSubscript("addItem").call(withArguments: [idURL.absoluteString])
            aayaatJSValues[idURL] = aayahJSValue!
        }
        // save full sm object, including items, in string form to smSingleton
        let smDataJSValue = smJSValue.objectForKeyedSubscript("data").call(withArguments: [])
        smSingleton.setValue(jsContext.objectForKeyedSubscript("JSON").objectForKeyedSubscript("stringify").call(withArguments: [smDataJSValue!]).toString(), forKey: "savedData")
        
        // save again
        do {
            try managedObjectContext.save()
        } catch let error as NSError {
            print("Could not save. \(error), \(error.userInfo)")
        }
    }
    

    func applicationDidFinishLaunching(_ aNotification: Notification) {
        // Insert code here to initialize your application
        managedObjectContext = self.persistentContainer.viewContext
        
        let x = try? managedObjectContext.fetch(NSFetchRequest(entityName: "SMSingleton"))
        if  (x?.count)! > 0 {
            smSingleton = x![0] as! SMSingleton
            initializeJSAndSM()
            // this saved data will include all item objects as well
            let smDataJSValue = jsContext.objectForKeyedSubscript("JSON").objectForKeyedSubscript("parse").call(withArguments: [JSValue(object: smSingleton.savedData!, in: jsContext)])
            smJSValue = jsContext.objectForKeyedSubscript("SM").objectForKeyedSubscript("load").call(withArguments: [smDataJSValue!])
            let itemsJSValue = smJSValue.objectForKeyedSubscript("q")
            , itemsJSValueLength = Int((itemsJSValue?.objectForKeyedSubscript("length").toInt32())!)
            for index in 0..<itemsJSValueLength {
                let itemJSValue = itemsJSValue?.objectAtIndexedSubscript(index)
                , itemIDURLString = itemJSValue?.objectForKeyedSubscript("value").toString()
                aayaatJSValues[URL(string: itemIDURLString!)!] = itemJSValue!
            }
        }
        else {
            smSingleton = SMSingleton(context: managedObjectContext)
            initializeJSAndSM()
            smJSValue = jsContext.objectForKeyedSubscript("SM").construct(withArguments: [])
            buildDataFromQuranFiles()
        }
    }
    
    func initializeJSAndSM() {
        jsContext.exceptionHandler = { context, exception in
            if exception != nil {
                print("JS Exception:", exception!.toString())
            }
        }
        
        // Specify the path to the jssource.js file.
        if let smJSSourcePath = Bundle.main.path(forResource: "sm", ofType: "js") {
            do {
                // Load its contents to a String variable.
                let smJSSourceContents = try String(contentsOfFile: smJSSourcePath)
                
                // Add the Javascript code that currently exists in the jsSourceContents to the Javascript Runtime through the jsContext object.
                jsContext.evaluateScript(smJSSourceContents)
            }
            catch {
                print(error.localizedDescription)
            }
        }
        else {
            return print("Couldn't find sm.js file!")
        }
    }

    func applicationWillTerminate(_ aNotification: Notification) {
        // Insert code here to tear down your application
    }

    // MARK: - Core Data stack

    lazy var persistentContainer: NSPersistentContainer = {
        /*
         The persistent container for the application. This implementation
         creates and returns a container, having loaded the store for the
         application to it. This property is optional since there are legitimate
         error conditions that could cause the creation of the store to fail.
        */
        let container = NSPersistentContainer(name: "Hifdh_Tracker")
        container.loadPersistentStores(completionHandler: { (storeDescription, error) in
            if let error = error {
                // Replace this implementation with code to handle the error appropriately.
                // fatalError() causes the application to generate a crash log and terminate. You should not use this function in a shipping application, although it may be useful during development.
                 
                /*
                 Typical reasons for an error here include:
                 * The parent directory does not exist, cannot be created, or disallows writing.
                 * The persistent store is not accessible, due to permissions or data protection when the device is locked.
                 * The device is out of space.
                 * The store could not be migrated to the current model version.
                 Check the error message to determine what the actual problem was.
                 */
                fatalError("Unresolved error \(error)")
            }
        })
        return container
    }()

    // MARK: - Core Data Saving and Undo support

    @IBAction func saveAction(_ sender: AnyObject?) {
        // Performs the save action for the application, which is to send the save: message to the application's managed object context. Any encountered errors are presented to the user.
        let context = persistentContainer.viewContext

        if !context.commitEditing() {
            NSLog("\(NSStringFromClass(type(of: self))) unable to commit editing before saving")
        }
        if context.hasChanges {
            do {
                try context.save()
            } catch {
                // Customize this code block to include application-specific recovery steps.
                let nserror = error as NSError
                NSApplication.shared.presentError(nserror)
            }
        }
    }

    func windowWillReturnUndoManager(window: NSWindow) -> UndoManager? {
        // Returns the NSUndoManager for the application. In this case, the manager returned is that of the managed object context for the application.
        return persistentContainer.viewContext.undoManager
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        // Save changes in the application's managed object context before the application terminates.
        let context = persistentContainer.viewContext
        
        if !context.commitEditing() {
            NSLog("\(NSStringFromClass(type(of: self))) unable to commit editing to terminate")
            return .terminateCancel
        }
        
        if !context.hasChanges {
            return .terminateNow
        }
        
        do {
            try context.save()
        } catch {
            let nserror = error as NSError

            // Customize this code block to include application-specific recovery steps.
            let result = sender.presentError(nserror)
            if (result) {
                return .terminateCancel
            }
            
            let question = NSLocalizedString("Could not save changes while quitting. Quit anyway?", comment: "Quit without saves error question message")
            let info = NSLocalizedString("Quitting now will lose any changes you have made since the last successful save", comment: "Quit without saves error question info");
            let quitButton = NSLocalizedString("Quit anyway", comment: "Quit anyway button title")
            let cancelButton = NSLocalizedString("Cancel", comment: "Cancel button title")
            let alert = NSAlert()
            alert.messageText = question
            alert.informativeText = info
            alert.addButton(withTitle: quitButton)
            alert.addButton(withTitle: cancelButton)
            
            let answer = alert.runModal()
            if answer == .alertSecondButtonReturn {
                return .terminateCancel
            }
        }
        // If we got here, it is time to quit.
        return .terminateNow
    }

}

