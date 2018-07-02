#! /usr/bin/perl -w

#
## @author: Shadow Caster
## @date: Sun 8 Feb 2009
## @version 0.0
## @license: Apache 2.0
##
## This script goes through the text of the Arabic quran from 114 text files. 
## The quran text was taken from http://www.holyquran.net  
## The script removes numbering (N.) and empty lines and saves to /s/N.txt files.
## The script then removes diacritics & similar characters and saves to /c/N.txt files. 
## The diacritic removal code is based on the script found on 
## http://www.islamic-dictionary.com/blog/?p=31
#

#define required variables
@chars = ('َ', 'ً', 'ُ', 'ٌ', 'ِ', 'ٍ', 'ْ', 'ّ');
@achars= ('أَ', 'أُ', 'إِ', 'اً', 'إ', 'آ', 'أ');

#loops through all 114 original files
for($i = 1; $i < 115; $i++){
	open(HANDLE, $i.".txt") or die("error opening in file"); #original file
	open(SHANDLE, ">./s/".$i.".txt") or die("error opening out file"); #sorted file
	open(CHANDLE, ">./c/".$i.".txt") or die("error opening c file"); #cleaned file

	while(<HANDLE>){
		if(/^\n\s?$/){next;} #skip empty line 
		if(/^\s+\d/){next;} #skip numbering

		#save to s file
		chomp($_);
		$_ =~ s/^\s+//g;
		$_ =~ s/\s+$//g;
		print SHANDLE $_."\n"; 
		
		#save to c file
		foreach $m(@chars){ #remove harakat
			$_ =~ s/$m//gi;
		}
		foreach $m(@achars){#replace all aliph variations
			$_ =~ s/$m/ا/gi;
		}
		$_ =~ s/(ـ)+//gi;   #remove multiple char connectors
		$_ =~ s/ة/ه/gi;     #replace ending taa with ending haa
		print CHANDLE $_."\n"; 
	}

	close(HANDLE); 
	close(SHANDLE);
	close(CHANDLE);
} #/for

print "All Done! \n";
