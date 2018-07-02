#! /usr/bin/perl -w

#
## @author: Shadow Caster
## @date: Tuesday 10 Feb 2009
## @version 0.0
## @license: Apache 2.0
##
## This script goes through the text of the diacritic-free Arabic quran from 
## 114 text files and counts how many words are in each surah. 
## It saves the results to a CSV file.
#

#open output CSV file
open(CSVHANDLE, ">./c/wordcount.csv") or die("Couldn't open CSV file");

#loop through all quran files
for($x = 1; $x < 115; $x++){
	open(HANDLE, "./c/$x.txt") or die("Couldn't open in file");

	$m = "";
	while(<HANDLE>){
		chomp($_);
		$m .= " ".$_." "; #spaces important to stop words joining
	}

	close(HANDLE);

	$m =~ s/^\s+//g; #remove spaces at beginning
	$m =~ s/\s+$//g; #remove spaces at end
	$m =~ s/\s+/ /g; #remove multiple spaces

	@arr = split(/ /, $m);
	print CSVHANDLE "$x, " . @arr . "\n";
}

close(CSVHANDLE); 
print "All Done! \n";
